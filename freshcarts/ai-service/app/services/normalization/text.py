"""Text normalisation: casing, whitespace, punctuation, script and OCR noise.

This runs before anything tries to understand a line. Its job is to make two
spellings of the same thing look the same, and nothing else - it never decides
what an item is, which is the extractor's job.

Deliberately conservative. Aggressive "correction" of OCR output destroys real
text: `1` and `l` genuinely both occur, and rewriting one into the other blindly
turns "1 litre" into "l litre". Every substitution here is either script
normalisation (unambiguous) or position-dependent (a digit-shaped letter inside
a run of digits).
"""

from __future__ import annotations

import re
import unicodedata

from app.services.normalization.digits import fold_digits

#: Bullets, list markers and stray punctuation an OCR pass reads off a
#: hand-drawn list. Stripped from the ends of a line, never from the middle,
#: because a hyphen inside "7-up" is part of the name.
_EDGE_NOISE = "-*+.,;:!?()[]{}<>|/\\\"'`~_ \t•●▪·–—‐"

#: Urdu/Arabic diacritics (harakat) and the tatweel elongation character. They
#: carry no lexical information for matching and OCR emits them inconsistently,
#: so two spellings of the same word differ only by noise without this.
_ARABIC_MARKS = re.compile(r"[ً-ْٰـ]")

#: Zero-width and directional marks. Invisible, and they break string equality.
_INVISIBLE = re.compile(r"[​-‏‪-‮⁦-⁩﻿]")

_WHITESPACE = re.compile(r"\s+")

#: Letters an OCR engine confuses with digits, applied ONLY when the character
#: sits inside a run that is otherwise numeric. "l kg" becomes "1 kg"; "kilo"
#: is left alone.
_DIGIT_LOOKALIKES = {"l": "1", "I": "1", "|": "1", "O": "0", "o": "0", "S": "5"}

_MIXED_NUMERIC = re.compile(r"\b(?=[0-9]*[lI|OoS])[0-9lI|OoS]{1,4}\b")

#: Urdu script range, used to decide which language a line is written in.
_URDU_LETTERS = re.compile(r"[؀-ۿݐ-ݿ]")

_LATIN_LETTERS = re.compile(r"[A-Za-z]")


def strip_invisible(text: str) -> str:
    return _INVISIBLE.sub("", text)


def fix_digit_lookalikes(text: str) -> str:
    """Repairs letters an OCR engine read in place of digits.

    Only a token that is *already* mostly numeric is touched, so this cannot
    damage a word: "l0" becomes "10", "lassi" stays "lassi".
    """

    def replace(match: re.Match[str]) -> str:
        token = match.group(0)
        # A token of pure lookalikes ("ll", "OO") is far more likely to be text
        # than a number, so require at least one real digit as evidence.
        if not any(character.isdigit() for character in token):
            return token
        return "".join(_DIGIT_LOOKALIKES.get(character, character) for character in token)

    return _MIXED_NUMERIC.sub(replace, text)


def normalize_line(text: str) -> str:
    """Canonical form of one line, preserving the original script.

    Case is folded, scripts and numerals are normalised, and noise is removed -
    but Urdu stays Urdu. Transliteration is the alias layer's job, and doing it
    here would throw away the information that tells us what language the list
    was written in.
    """
    # NFKC first: it unifies the many Unicode spellings of the same Urdu letter,
    # so the alias table needs one entry per word rather than one per encoding.
    result = unicodedata.normalize("NFKC", text)
    result = strip_invisible(result)
    result = _ARABIC_MARKS.sub("", result)
    result = fold_digits(result)
    result = fix_digit_lookalikes(result)
    result = _WHITESPACE.sub(" ", result)
    result = result.strip(_EDGE_NOISE)

    return result.lower().strip()


#: A token is either a number - decimal included, with either separator, since
#: OCR reads a full stop as a comma constantly - or a run of letters. Matching
#: what a token IS rather than splitting on what it is not keeps "1.5" whole
#: while still separating "1kg" into "1" and "kg", and leaves Urdu words intact
#: because they are letters.
_TOKEN = re.compile(r"\d+(?:[.,]\d+)?|[^\W\d_]+", re.UNICODE)


def tokenize(text: str) -> list[str]:
    """Splits a normalised line into comparable tokens."""
    return _TOKEN.findall(text)


def detect_script(text: str) -> str:
    """Which script a line is written in: "urdu", "latin", "mixed" or "unknown"."""
    has_urdu = bool(_URDU_LETTERS.search(text))
    has_latin = bool(_LATIN_LETTERS.search(text))

    if has_urdu and has_latin:
        return "mixed"
    if has_urdu:
        return "urdu"
    if has_latin:
        return "latin"
    return "unknown"


def split_lines(text: str) -> list[str]:
    """Breaks raw OCR text into candidate item lines.

    A grocery list is one item per line, so newlines are the primary separator.
    Commas are honoured too, because a list photographed from a phone note is
    often written "milk, eggs, bread" on one line.
    """
    lines: list[str] = []

    for raw_line in text.splitlines():
        for part in raw_line.split(","):
            candidate = part.strip()
            if candidate:
                lines.append(candidate)

    return lines
