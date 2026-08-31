"""Text normalisation and the alias vocabulary (sections 14, 15 and 51)."""

from __future__ import annotations

import pytest

from app.services.normalization import (
    brand_aliases,
    detect_script,
    fix_digit_lookalikes,
    fold_digits,
    grocery_aliases,
    normalize_line,
    split_lines,
    tokenize,
    unit_aliases,
)


class TestDigitFolding:
    @pytest.mark.parametrize(
        ("written", "expected"),
        [
            ("۱", "1"),
            ("۲", "2"),
            ("۵", "5"),
            ("۱۲", "12"),
            ("۲ دودھ", "2 دودھ"),
            ("١٢", "12"),  # Arabic-Indic, which differs from Urdu for 4-7.
        ],
    )
    def test_urdu_and_arabic_numerals_become_ascii(self, written: str, expected: str) -> None:
        assert fold_digits(written) == expected

    def test_letters_are_never_touched(self) -> None:
        # A numeral fold, not a transliteration: the Urdu word survives intact.
        assert fold_digits("دودھ") == "دودھ"


class TestDigitLookalikes:
    def test_a_letter_inside_a_number_is_corrected(self) -> None:
        assert fix_digit_lookalikes("l0 anday") == "10 anday"

    def test_a_word_is_left_alone(self) -> None:
        # The dangerous case: rewriting letters blindly turns words into numbers.
        assert fix_digit_lookalikes("lassi") == "lassi"
        assert fix_digit_lookalikes("oil") == "oil"

    def test_a_token_with_no_real_digit_is_left_alone(self) -> None:
        assert fix_digit_lookalikes("ll") == "ll"


class TestNormalizeLine:
    def test_folds_case_whitespace_and_list_markers(self) -> None:
        assert normalize_line("  -  2   MILK  ") == "2 milk"

    def test_keeps_urdu_as_urdu(self) -> None:
        # Transliteration is the alias layer's job. Doing it here would destroy
        # the signal that tells us which script the list was written in.
        assert normalize_line("۲ دودھ") == "2 دودھ"

    def test_strips_bullets_without_breaking_hyphenated_names(self) -> None:
        assert normalize_line("• 7-up") == "7-up"

    def test_removes_urdu_diacritics(self) -> None:
        # Same word, once with harakat and once without: OCR emits both.
        assert normalize_line("چِینی") == normalize_line("چینی")


class TestSplitLines:
    def test_splits_on_newlines_and_commas(self) -> None:
        assert split_lines("milk, eggs\nbread") == ["milk", "eggs", "bread"]

    def test_drops_empty_fragments(self) -> None:
        assert split_lines("milk,,\n\n") == ["milk"]


class TestTokenize:
    def test_separates_a_number_glued_to_a_word(self) -> None:
        assert tokenize("2kg atta") == ["2", "kg", "atta"]

    def test_keeps_urdu_words_whole(self) -> None:
        assert tokenize("2 دودھ") == ["2", "دودھ"]


class TestScriptDetection:
    @pytest.mark.parametrize(
        ("text", "expected"),
        [
            ("2 milk", "latin"),
            ("۲ دودھ", "urdu"),
            ("2 doodh دودھ", "mixed"),
            ("123", "unknown"),
        ],
    )
    def test_reports_the_script_a_line_is_written_in(self, text: str, expected: str) -> None:
        assert detect_script(text) == expected


class TestGroceryAliases:
    @pytest.mark.parametrize(
        ("written", "canonical"),
        [
            # Section 15's own examples.
            ("doodh", "milk"),
            ("dudh", "milk"),
            ("dood", "milk"),
            ("cheeni", "sugar"),
            ("chini", "sugar"),
            ("anda", "eggs"),
            ("anday", "eggs"),
            ("ande", "eggs"),
            ("atta", "flour"),
            ("aata", "flour"),
            ("dahi", "yogurt"),
            ("dahee", "yogurt"),
            # Urdu script.
            ("دودھ", "milk"),
            ("چینی", "sugar"),
            ("انڈے", "eggs"),
            ("آٹا", "flour"),
        ],
    )
    def test_roman_urdu_and_urdu_resolve_to_english(self, written: str, canonical: str) -> None:
        assert grocery_aliases().resolve(written) == canonical

    def test_casing_and_spacing_do_not_matter(self) -> None:
        assert grocery_aliases().resolve("  DOODH  ") == "milk"

    def test_a_multi_word_phrase_beats_its_first_word(self) -> None:
        # "double roti" is bread; "roti" on its own is a different food and is
        # deliberately not in the vocabulary at all.
        assert grocery_aliases().resolve("double roti") == "bread"
        assert grocery_aliases().resolve("roti") is None

    def test_an_unknown_word_resolves_to_nothing(self) -> None:
        # It must not be guessed at - the catalogue gets a chance at it instead.
        assert grocery_aliases().resolve("qwertyuiop") is None

    def test_resolve_phrase_consumes_the_longest_match(self) -> None:
        assert grocery_aliases().resolve_phrase(["double", "roti", "2"]) == ("bread", 2)

    def test_find_phrase_locates_a_word_that_is_not_first(self) -> None:
        assert grocery_aliases().find_phrase(["fresh", "green", "doodh"]) == ("milk", 2, 1)


class TestUnitAliases:
    @pytest.mark.parametrize(
        ("written", "canonical"),
        [
            ("kg", "kg"),
            ("kilo", "kg"),
            ("kilogram", "kg"),
            ("کلو", "kg"),
            ("gram", "g"),
            ("gm", "g"),
            ("litre", "liter"),
            ("l", "liter"),
            ("ml", "ml"),
            ("dozen", "dozen"),
            ("doz", "dozen"),
            ("درجن", "dozen"),
            ("pcs", "piece"),
            ("pc", "piece"),
        ],
    )
    def test_units_normalise(self, written: str, canonical: str) -> None:
        assert unit_aliases().resolve(written) == canonical

    def test_measure_and_count_units_are_distinguished(self) -> None:
        # The distinction that stops "500 g namak" becoming 500 packets.
        units = unit_aliases()
        assert units.is_measure("kg")
        assert units.is_measure("g")
        assert units.is_measure("liter")
        assert not units.is_measure("dozen")
        assert not units.is_measure("piece")

    def test_an_unknown_unit_defaults_to_a_count(self) -> None:
        # The safe reading, and the one the shopper can see and correct.
        assert not unit_aliases().is_measure("bushel")


class TestBrandAliases:
    def test_common_misspellings_resolve(self) -> None:
        assert brand_aliases().resolve("olpers") == "Olper's"
        assert brand_aliases().resolve("surf excel") == "Surf Excel"

    def test_an_unlisted_brand_is_not_invented(self) -> None:
        assert brand_aliases().resolve("acme") is None
