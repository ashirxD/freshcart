"""Text normalisation and the grocery alias vocabulary.

The public surface of the layer, so callers import from the package rather than
reaching into its modules and pinning the internal layout in place.
"""

from app.services.normalization.aliases import (
    AliasEntry,
    AliasRegistry,
    QuantityWordRegistry,
    UnitRegistry,
    brand_aliases,
    grocery_aliases,
    quantity_words,
    unit_aliases,
    vocabulary_sizes,
)
from app.services.normalization.digits import contains_non_ascii_digits, fold_digits
from app.services.normalization.text import (
    detect_script,
    fix_digit_lookalikes,
    normalize_line,
    split_lines,
    tokenize,
)

__all__ = [
    "AliasEntry",
    "AliasRegistry",
    "QuantityWordRegistry",
    "UnitRegistry",
    "brand_aliases",
    "contains_non_ascii_digits",
    "detect_script",
    "fix_digit_lookalikes",
    "fold_digits",
    "grocery_aliases",
    "normalize_line",
    "quantity_words",
    "split_lines",
    "tokenize",
    "unit_aliases",
    "vocabulary_sizes",
]
