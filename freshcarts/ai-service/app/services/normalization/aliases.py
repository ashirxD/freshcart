"""The extensible alias system section 15 asks for.

The vocabulary lives in JSON data files, not in code. That matters for a reason
beyond tidiness: this vocabulary will grow constantly and from a different
source than the code does - a shopkeeper noticing that people write "dood",
support seeing a failed scan. Making it data means adding a word is a one-line
change to a file with no code review of parser logic attached, and the same
files can later be moved into the database or an admin screen without touching a
single caller.

The registry itself is deliberately small: build one lookup table, resolve
longest phrase first, and stop. There is no stemming, no fuzzy matching and no
model here - fuzziness belongs in the NestJS matcher, which has the actual
catalogue to be fuzzy against.
"""

from __future__ import annotations

import json
import unicodedata
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Iterable

from app.services.normalization.digits import fold_digits

DATA_DIR = Path(__file__).parent / "data"


def _fold(term: str) -> str:
    """Lookup key for a vocabulary term.

    Must match how `normalize_line` treats text, or an entry would never be
    found: same Unicode normalisation, same numeral folding, same casing.
    """
    return " ".join(fold_digits(unicodedata.normalize("NFKC", term)).lower().split())


@dataclass(frozen=True)
class AliasEntry:
    canonical: str
    aliases: tuple[str, ...]


class AliasRegistry:
    """Maps any known spelling of a thing to its canonical name."""

    def __init__(self, entries: Iterable[AliasEntry]) -> None:
        self._entries = tuple(entries)
        self._lookup: dict[str, str] = {}
        #: Longest phrase first, so "double roti" wins over "roti" and
        #: "chana daal" over "daal". Without this ordering a two-word alias
        #: could never be reached.
        self._max_words = 1

        for entry in self._entries:
            for term in (entry.canonical, *entry.aliases):
                key = _fold(term)
                if not key:
                    continue
                # First declaration wins, so a word listed under two entries
                # resolves predictably rather than by file order.
                self._lookup.setdefault(key, entry.canonical)
                self._max_words = max(self._max_words, len(key.split()))

    @property
    def max_phrase_words(self) -> int:
        return self._max_words

    def resolve(self, term: str) -> str | None:
        """The canonical name for `term`, or None when it is not vocabulary."""
        return self._lookup.get(_fold(term))

    def knows(self, term: str) -> bool:
        return _fold(term) in self._lookup

    def resolve_phrase(self, tokens: list[str]) -> tuple[str, int] | None:
        """Longest known phrase at the start of `tokens`.

        Returns the canonical name and how many tokens it consumed, so a caller
        can carry on after the match. None when nothing matches.
        """
        for length in range(min(self._max_words, len(tokens)), 0, -1):
            canonical = self.resolve(" ".join(tokens[:length]))
            if canonical is not None:
                return canonical, length

        return None

    def find_phrase(self, tokens: list[str]) -> tuple[str, int, int] | None:
        """First known phrase anywhere in `tokens`.

        Returns (canonical, start index, token count). Used where the item name
        is not at the front of the line - "anday 1 dozen" and "Surf 1" both put
        the interesting word in a different place.
        """
        for start in range(len(tokens)):
            match = self.resolve_phrase(tokens[start:])
            if match is not None:
                canonical, length = match
                return canonical, start, length

        return None


class QuantityWordRegistry:
    """Numbers written as words, in English and Urdu."""

    def __init__(self, mapping: dict[str, float]) -> None:
        self._mapping = mapping

    def resolve(self, term: str) -> float | None:
        return self._mapping.get(_fold(term))


class UnitRegistry(AliasRegistry):
    """Units, plus the one thing about them that changes meaning: their kind.

    A `measure` unit makes the number beside it a SIZE - "500 g namak" is one
    bag that weighs 500 g. A `count` unit makes it a QUANTITY - "2 dozen anday"
    is two boxes. Reading that distinction wrong is how a shopping list turns
    into an order for five hundred packets of salt, which is why the kind is
    part of the vocabulary rather than a rule buried in the parser.
    """

    def __init__(self, entries: Iterable[AliasEntry], kinds: dict[str, str]) -> None:
        super().__init__(entries)
        self._kinds = kinds

    def kind_of(self, canonical: str) -> str:
        """"measure", "count", or "count" for anything unrecognised.

        Defaulting to `count` is the safe reading: an unknown unit beside "2"
        most likely means two of something, and a count is the interpretation
        the shopper can see and correct on the review screen.
        """
        return self._kinds.get(canonical, "count")

    def is_measure(self, canonical: str | None) -> bool:
        return canonical is not None and self.kind_of(canonical) == "measure"


def _load(filename: str) -> dict:
    with (DATA_DIR / filename).open(encoding="utf-8") as handle:
        return json.load(handle)


def _entries_from(filename: str) -> tuple[AliasEntry, ...]:
    payload = _load(filename)
    return tuple(
        AliasEntry(
            canonical=entry["canonical"],
            aliases=tuple(entry.get("aliases", ())),
        )
        for entry in payload["entries"]
    )


# Built once per process. The data files are read-only inputs, so there is no
# reload path to get wrong; restarting the service picks up an edit.


@lru_cache(maxsize=1)
def grocery_aliases() -> AliasRegistry:
    return AliasRegistry(_entries_from("grocery_aliases.json"))


@lru_cache(maxsize=1)
def unit_aliases() -> UnitRegistry:
    payload = _load("units.json")

    entries = tuple(
        AliasEntry(canonical=entry["canonical"], aliases=tuple(entry.get("aliases", ())))
        for entry in payload["entries"]
    )
    kinds = {entry["canonical"]: entry.get("kind", "count") for entry in payload["entries"]}

    return UnitRegistry(entries, kinds)


@lru_cache(maxsize=1)
def brand_aliases() -> AliasRegistry:
    return AliasRegistry(_entries_from("brands.json"))


@lru_cache(maxsize=1)
def quantity_words() -> QuantityWordRegistry:
    payload = _load("quantity_words.json")
    mapping: dict[str, float] = {}

    for entry in payload["entries"]:
        for word in entry["words"]:
            mapping.setdefault(_fold(word), float(entry["value"]))

    return QuantityWordRegistry(mapping)


def vocabulary_sizes() -> dict[str, int]:
    """Counts for the health endpoint, so a misconfigured data directory shows."""
    return {
        "groceryTerms": len(grocery_aliases()._lookup),  # noqa: SLF001 - diagnostics
        "unitTerms": len(unit_aliases()._lookup),  # noqa: SLF001
        "brandTerms": len(brand_aliases()._lookup),  # noqa: SLF001
    }
