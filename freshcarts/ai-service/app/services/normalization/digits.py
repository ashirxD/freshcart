"""Numerals, in every script a Pakistani grocery list actually uses.

Urdu lists are written with Extended Arabic-Indic digits, and a photo of a
handwritten list mixes them with Western ones freely. Folding them to a single
representation here means every downstream parser sees plain ASCII digits and
none of them has to know about scripts.
"""

from __future__ import annotations

#: Extended Arabic-Indic (Urdu/Persian) and Arabic-Indic (Arabic) digits.
#: Both appear in practice; the two ranges differ for 4, 5, 6 and 7.
_DIGIT_MAP = {
    # Extended Arabic-Indic, U+06F0..U+06F9 - the Urdu forms.
    "۰": "0",
    "۱": "1",
    "۲": "2",
    "۳": "3",
    "۴": "4",
    "۵": "5",
    "۶": "6",
    "۷": "7",
    "۸": "8",
    "۹": "9",
    # Arabic-Indic, U+0660..U+0669.
    "٠": "0",
    "١": "1",
    "٢": "2",
    "٣": "3",
    "٤": "4",
    "٥": "5",
    "٦": "6",
    "٧": "7",
    "٨": "8",
    "٩": "9",
}

_TRANSLATION = str.maketrans(_DIGIT_MAP)


def fold_digits(text: str) -> str:
    """Rewrites Urdu and Arabic numerals as ASCII digits.

    Only digits are touched. Letters, including Urdu letters, are left exactly
    as they were - this is a numeral fold, not a transliteration.
    """
    return text.translate(_TRANSLATION)


def contains_non_ascii_digits(text: str) -> bool:
    """True when the text was written with Urdu or Arabic numerals.

    Used as one signal for detecting the language of a list.
    """
    return any(character in _DIGIT_MAP for character in text)
