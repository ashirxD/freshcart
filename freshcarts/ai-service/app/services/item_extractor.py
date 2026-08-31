"""Turns OCR lines into structured grocery items (section 12).

The separation section 10 insists on runs through this file: the raw line is
carried on every item, untouched, alongside the structured reading of it. When a
match later turns out to be wrong, the shopper sees what they actually wrote and
the failure is traceable rather than mysterious.

What this does NOT do: decide which product an item is. That needs the
catalogue, the catalogue lives in MongoDB, and MongoDB belongs to NestJS
(section 0). This produces intelligence; NestJS decides what to do with it.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from app.services.normalization import (
    brand_aliases,
    detect_script,
    grocery_aliases,
    normalize_line,
    split_lines,
    tokenize,
)
from app.services.quantity import clamp_count, clamp_size, parse_quantity

#: Lines that are a heading or a scribble rather than an item.
_NOISE_LINES = {
    "list",
    "grocery",
    "grocery list",
    "shopping list",
    "items",
    "item",
    "total",
    "note",
    "notes",
    "date",
    "to buy",
    "sauda",
    "saman",
    "فہرست",
    "سامان",
}

#: Words that carry no meaning once the numbers are out. "s" is what is left of
#: a possessive after tokenising "Olper's"; "x" is multiplier notation the
#: quantity parser has already accounted for.
_STOPWORDS = {"s", "x", "of", "the", "and", "aur", "ka", "ke", "ki", "wala", "wali"}

#: Words that qualify an item without naming it. Kept out of the name so that
#: "fresh milk" and "milk" search the catalogue the same way, but recorded so
#: the review screen can still show what the shopper asked for.
_QUALIFIERS = {
    "fresh",
    "full",
    "cream",
    "large",
    "small",
    "big",
    "desi",
    "brown",
    "white",
    "red",
    "green",
    "organic",
    "taza",
    "bara",
    "chota",
}

#: A line with no letters at all is a page number or a stray mark.
_HAS_LETTER = re.compile(r"[^\W\d_]", re.UNICODE)

#: The shortest a real grocery name can be.
#:
#: Found by running the pipeline over a deliberately unreadable image: OCR
#: reported "O 0" with reasonable confidence, and a single stray letter became
#: an item on somebody's shopping list. No grocery is named with one character,
#: so this costs nothing and removes a whole class of nonsense.
MIN_NAME_LETTERS = 2

#: A grocery line is short - "2 doodh", "5 kg basmati rice". Past this it is
#: prose, and the photo is of something that is not a shopping list. Rejecting
#: it means a mis-aimed camera produces "we could not find any grocery items"
#: (section 58) rather than a screen full of sentences to review.
MAX_LINE_TOKENS = 6


@dataclass(frozen=True)
class ExtractedItem:
    """One grocery item, as read off the page."""

    #: Exactly what was on the line. Never rewritten (section 10).
    raw_text: str
    #: The item name with known Roman-Urdu and Urdu words translated in place.
    #: Other words keep their position, so "basmati rice" stays "basmati rice"
    #: rather than collapsing to "rice" and losing what made it findable.
    normalized_name: str
    #: How many products to buy.
    quantity: int
    #: Normalised unit, or None when the line did not give one.
    unit: str | None
    #: The pack size asked for, in `unit` - 500 for "500 g namak". None when no
    #: size was written. Distinct from `quantity`; see section 22.
    unit_value: float | None
    brand: str | None
    #: The engine's confidence in READING THIS LINE. Never a product-match
    #: confidence - those are different measurements and section 10 forbids
    #: conflating them.
    confidence: float | None
    #: True when the vocabulary recognised the item, so the caller can tell a
    #: known word from one being passed through for the catalogue to try.
    recognized: bool
    qualifiers: tuple[str, ...] = ()
    #: Set when the written quantity had to be adjusted, so the UI can say so.
    quantity_adjusted: bool = False
    script: str = "latin"


@dataclass
class ExtractionResult:
    items: list[ExtractedItem] = field(default_factory=list)
    #: Lines that were read but produced nothing. Counted, never echoed back -
    #: they are somebody's shopping list.
    skipped_lines: int = 0
    warnings: list[str] = field(default_factory=list)


def _is_noise(normalized: str) -> bool:
    if not normalized or normalized in _NOISE_LINES:
        return True
    # No letters anywhere: a page number, a stray tick, a scanning artefact.
    return not _HAS_LETTER.search(normalized)


def _translate(tokens: list[str]) -> tuple[list[str], bool]:
    """Rewrites known vocabulary in place, leaving everything else alone.

    Walking left to right and replacing the longest known phrase at each
    position is what keeps word order intact. Lifting the matched word to the
    end instead would turn "basmati rice" into "rice basmati" - and, worse,
    would let a variety and its category swap places.
    """
    vocabulary = grocery_aliases()
    output: list[str] = []
    recognized = False

    index = 0
    while index < len(tokens):
        match = vocabulary.resolve_phrase(tokens[index:])

        if match is None:
            output.append(tokens[index])
            index += 1
            continue

        canonical, length = match
        recognized = True
        # Skip a canonical that is already there: "basmati rice" must not
        # become "rice rice" when a variety maps onto its own category.
        if canonical not in output:
            output.append(canonical)
        index += length

    return output, recognized


def extract_item(
    raw_line: str,
    *,
    confidence: float | None = None,
    min_length: int = 2,
) -> ExtractedItem | None:
    """Reads one line. Returns None when there is no item on it."""
    normalized = normalize_line(raw_line)

    if _is_noise(normalized) or len(normalized) < min_length:
        return None

    tokens = tokenize(normalized)
    if len(tokens) > MAX_LINE_TOKENS:
        return None

    parsed = parse_quantity(normalized)
    quantity, adjusted = clamp_count(parsed.count)

    # Whatever is left once the numbers and the unit have been taken out is the
    # name, wherever on the line it happened to be. That is what makes
    # "2 doodh", "doodh 2" and "anday 1 dozen" all work without a grammar.
    name_tokens = [
        token
        for index, token in enumerate(tokens)
        if index not in parsed.consumed and token not in _STOPWORDS
    ]

    brand, name_tokens = _take_brand(name_tokens)
    qualifiers, remaining = _take_qualifiers(name_tokens)

    # Qualifiers are only dropped when something is left to name the item;
    # "brown" alone is the whole request, however unhelpfully phrased.
    if not remaining:
        remaining, qualifiers = name_tokens, ()

    if not remaining:
        # The line was a brand and a number ("Surf 1"). The brand IS the item,
        # and the catalogue can find it - so it must not be thrown away.
        if brand:
            return _build(
                raw_line,
                name=brand.lower(),
                quantity=quantity,
                parsed=parsed,
                brand=brand,
                confidence=confidence,
                recognized=True,
                qualifiers=(),
                adjusted=adjusted,
            )
        return None

    translated, recognized = _translate(remaining)
    name = " ".join(translated)

    # A name of one letter is scanning noise, not an item.
    if not recognized and len(_HAS_LETTER.findall(name)) < MIN_NAME_LETTERS:
        return None

    return _build(
        raw_line,
        name=name,
        quantity=quantity,
        parsed=parsed,
        brand=brand,
        confidence=confidence,
        recognized=recognized,
        qualifiers=qualifiers,
        adjusted=adjusted,
    )


def _build(
    raw_line: str,
    *,
    name: str,
    quantity: int,
    parsed,
    brand: str | None,
    confidence: float | None,
    recognized: bool,
    qualifiers: tuple[str, ...],
    adjusted: bool,
) -> ExtractedItem:
    return ExtractedItem(
        raw_text=raw_line.strip(),
        normalized_name=name,
        quantity=quantity,
        unit=parsed.unit,
        unit_value=clamp_size(parsed.size),
        brand=brand,
        confidence=confidence,
        recognized=recognized,
        qualifiers=qualifiers,
        quantity_adjusted=adjusted,
        script=detect_script(raw_line),
    )


def _take_brand(tokens: list[str]) -> tuple[str | None, list[str]]:
    """Lifts a recognised brand out of the token list."""
    match = brand_aliases().find_phrase(tokens)

    if match is None:
        return None, tokens

    canonical, start, length = match
    return canonical, tokens[:start] + tokens[start + length :]


def _take_qualifiers(tokens: list[str]) -> tuple[tuple[str, ...], list[str]]:
    qualifiers = tuple(token for token in tokens if token in _QUALIFIERS)
    remaining = [token for token in tokens if token not in _QUALIFIERS]
    return qualifiers, remaining


def extract_items(
    text: str,
    *,
    line_confidences: list[float | None] | None = None,
    max_items: int = 60,
    min_line_length: int = 2,
) -> ExtractionResult:
    """Reads a whole list.

    `line_confidences` lines up with the engine's own lines when it reported
    them. It is positional rather than keyed because splitting on commas can
    turn one engine line into several items, and all of them inherit that
    line's confidence - which is honest: the engine scored the line, not the
    fragments.
    """
    result = ExtractionResult()
    seen: dict[str, int] = {}

    for line_index, raw_line in enumerate(text.splitlines()):
        confidence = (
            line_confidences[line_index]
            if line_confidences is not None and line_index < len(line_confidences)
            else None
        )

        for fragment in split_lines(raw_line):
            if len(result.items) >= max_items:
                result.warnings.append(f"Only the first {max_items} items on the list were read.")
                return result

            item = extract_item(fragment, confidence=confidence, min_length=min_line_length)

            if item is None:
                result.skipped_lines += 1
                continue

            # The same item written twice is one line with the quantities added,
            # which is what a shopper means by writing "milk" at the top and
            # "2 milk" further down.
            key = str((item.normalized_name, item.unit, item.unit_value, item.brand))
            existing = seen.get(key)

            if existing is not None:
                result.items[existing] = _merge(result.items[existing], item)
                continue

            seen[key] = len(result.items)
            result.items.append(item)

    return result


def _merge(previous: ExtractedItem, addition: ExtractedItem) -> ExtractedItem:
    return ExtractedItem(
        raw_text=f"{previous.raw_text} + {addition.raw_text}",
        normalized_name=previous.normalized_name,
        quantity=min(previous.quantity + addition.quantity, 99),
        unit=previous.unit,
        unit_value=previous.unit_value,
        brand=previous.brand,
        confidence=_lower_confidence(previous.confidence, addition.confidence),
        recognized=previous.recognized,
        qualifiers=previous.qualifiers,
        quantity_adjusted=previous.quantity_adjusted or addition.quantity_adjusted,
        script=previous.script,
    )


def _lower_confidence(left: float | None, right: float | None) -> float | None:
    """The more pessimistic of two readings, or None when neither is known."""
    known = [value for value in (left, right) if value is not None]
    return min(known) if known else None
