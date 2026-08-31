"""Quantity and unit parsing (sections 13, 14 and 22).

Scope, stated plainly: this is a practical parser for how people actually write
grocery lists, not an NLP system. It handles a number and a unit appearing in
either order, anywhere on the line, written in digits or words, in Latin or Urdu
script. It does not attempt to understand prose, and section 13 explicitly asks
it not to try.

THE DISTINCTION THAT MATTERS (section 22)

A number on a grocery list means one of two completely different things, and
which one depends on the unit standing next to it:

    "500 g namak"   ->  one bag, and the bag weighs 500 g       (a SIZE)
    "2 dozen anday" ->  two boxes, each holding a dozen         (a COUNT)
    "2 milk"        ->  two of whatever milk they usually buy   (a COUNT)

Getting this backwards turns a request for half a kilo of salt into an order for
five hundred packets. So the parser reports both readings separately - `count`
and `size` - and never collapses them.

The other rule it never breaks: when something is unclear, say so rather than
guess. An unrecognised unit comes back as None and the raw text survives, so the
matcher downstream still has everything the shopper wrote.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from app.services.normalization import quantity_words, tokenize, unit_aliases

#: A bare number, possibly decimal. A comma is accepted as a decimal separator
#: because OCR frequently reads a full stop as one.
_NUMBER = re.compile(r"^\d+(?:[.,]\d+)?$")

#: Multiplier notation. The tokeniser separates "2x" into "2" and "x", so the
#: marker arrives on its own and its job is to say that the number before it
#: was a count rather than a size: "2 x 1kg atta" is two one-kilo bags.
_MULTIPLIER_MARK = "x"

#: More than this of one product is a misread, not an order. Someone writing
#: "1000 milk" has had an OCR failure, and passing it through would put an
#: absurd line in front of the shopper.
MAX_QUANTITY = 99

#: A pack size beyond this is likewise not real ("5000 kg atta").
MAX_SIZE = 100_000


@dataclass(frozen=True)
class ParsedQuantity:
    """The two readings of the numbers on a line, kept apart.

    `count` is None when the line gave no count at all - which is normal
    ("bread" on its own) and means one, but recording it as None rather than 1
    lets the extractor explain why it is one.

    `size` is the pack size the shopper asked for, expressed in `unit`. None
    when they did not ask for one.
    """

    count: float | None
    size: float | None
    unit: str | None
    #: Token indexes consumed, so the extractor can strip them from the name.
    consumed: frozenset[int]


def _to_number(text: str) -> float | None:
    if not _NUMBER.match(text):
        return None
    try:
        return float(text.replace(",", "."))
    except ValueError:
        return None


def parse_quantity(text: str) -> ParsedQuantity:
    """Pulls the numbers and the unit out of one normalised line.

    Examples, all of which the tests pin down:
        "2 milk"          -> count 2,    size None, unit None
        "1 kg cheeni"     -> count None, size 1,    unit "kg"
        "500g namak"      -> count None, size 500,  unit "g"
        "anday 1 dozen"   -> count 1,    size None, unit "dozen"
        "2 x 1kg atta"    -> count 2,    size 1,    unit "kg"
        "do doodh"        -> count 2,    size None, unit None
        "bread"           -> count None, size None, unit None
    """
    tokens = tokenize(text)
    units = unit_aliases()
    words = quantity_words()

    unit: str | None = None
    #: Numbers found glued to, or standing beside, a measure unit.
    sizes: list[float] = []
    #: Numbers found with a count unit, a multiplier, or no unit at all.
    counts: list[float] = []
    #: Numbers seen before any unit was known. Which list they belong to cannot
    #: be decided until the unit is, so they wait here.
    pending: list[float] = []
    consumed: set[int] = set()

    index = 0
    while index < len(tokens):
        token = tokens[index]

        # "x" - whatever number came before it was a count, whatever follows is
        # a separate reading. This is what keeps "2 x 1kg atta" as two bags of
        # one kilo rather than one bag of two.
        if token == _MULTIPLIER_MARK:
            counts.extend(pending)
            pending.clear()
            consumed.add(index)
            index += 1
            continue

        number = _to_number(token)
        if number is not None:
            pending.append(number)
            consumed.add(index)
            index += 1
            continue

        # A unit phrase, which may be more than one token ("kilo gram").
        unit_match = units.resolve_phrase(tokens[index:])
        if unit_match is not None:
            canonical, length = unit_match
            unit = unit or canonical

            # A number immediately before the unit belongs to it. Anything
            # earlier on the line is a separate count ("2 packets 1 kg atta").
            if pending:
                attached = pending.pop()
                (sizes if units.is_measure(canonical) else counts).append(attached)
                counts.extend(pending)
                pending.clear()

            consumed.update(range(index, index + length))
            index += length
            continue

        # A number written as a word. Only accepted when it is not the whole
        # line: "ek" alone is not an order for one of something unnamed, and
        # "a" is far more often an article than a quantity.
        word_value = words.resolve(token)
        if word_value is not None and not pending and len(tokens) > 1:
            pending.append(word_value)
            consumed.add(index)
            index += 1
            continue

        index += 1

    # Numbers that never met a unit are counts - "2 milk".
    counts.extend(pending)

    return ParsedQuantity(
        count=counts[0] if counts else None,
        size=sizes[0] if sizes else None,
        unit=unit,
        consumed=frozenset(consumed),
    )


def clamp_count(count: float | None) -> tuple[int, bool]:
    """Turns a parsed count into a whole number of products to buy.

    Returns the number and whether it had to be adjusted, so the caller can warn
    the shopper instead of silently changing what they asked for.
    """
    if count is None:
        return 1, False

    if count <= 0 or count < 1:
        # "0 milk" or "half milk" with no unit: one is the only sane reading,
        # and the shopper can see and change it on the review screen.
        return 1, True

    if count > MAX_QUANTITY:
        return MAX_QUANTITY, True

    rounded = int(round(count))
    return rounded, rounded != count


def clamp_size(size: float | None) -> float | None:
    """Keeps a pack size plausible, or drops it entirely when it is not.

    Dropping is deliberate: a size of 5000 kg is a misread, and passing it to
    the matcher would push every sensible product down the ranking. Without it
    the item still matches on name alone, which is the right fallback.
    """
    if size is None or size <= 0 or size > MAX_SIZE:
        return None

    return size
