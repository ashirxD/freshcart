"""Quantity and unit extraction (sections 13, 14 and 22)."""

from __future__ import annotations

import pytest

from app.services.normalization import normalize_line
from app.services.quantity import (
    MAX_QUANTITY,
    clamp_count,
    clamp_size,
    parse_quantity,
)


def parse(text: str):
    return parse_quantity(normalize_line(text))


class TestCounts:
    @pytest.mark.parametrize(
        ("line", "expected"),
        [
            ("2 milk", 2),
            ("2 doodh", 2),
            ("milk 3", 3),
            ("12 anday", 12),
            ("2x dahi", 2),
            ("x2 dahi", 2),
        ],
    )
    def test_a_number_with_no_measure_unit_is_a_count(self, line: str, expected: int) -> None:
        assert parse(line).count == expected

    def test_a_line_with_no_number_reports_no_count(self) -> None:
        # None rather than 1, so the extractor can explain why it became one.
        assert parse("bread").count is None

    @pytest.mark.parametrize(
        ("line", "expected"),
        [
            ("do doodh", 2),
            ("ek anda", 1),
            ("teen bread", 3),
            ("two milk", 2),
            ("panch anday", 5),
        ],
    )
    def test_numbers_written_as_words_are_understood(self, line: str, expected: int) -> None:
        assert parse(line).count == expected

    def test_a_number_word_alone_is_not_treated_as_a_quantity(self) -> None:
        # "ek" on its own is not an order for one of something unnamed - and
        # "a" is an article far more often than it is a number.
        assert parse("ek").count is None


class TestSizes:
    @pytest.mark.parametrize(
        ("line", "size", "unit"),
        [
            ("1 kg cheeni", 1, "kg"),
            ("500g namak", 500, "g"),
            ("2 kg rice", 2, "kg"),
            ("1.5 litre doodh", 1.5, "liter"),
            ("250 ml cream", 250, "ml"),
            ("2 kilo chawal", 2, "kg"),
        ],
    )
    def test_a_number_beside_a_measure_unit_is_a_size(
        self, line: str, size: float, unit: str
    ) -> None:
        # THE case section 22 is about: "500 g namak" is one bag weighing 500 g,
        # never five hundred bags of salt.
        parsed = parse(line)
        assert parsed.size == size
        assert parsed.unit == unit
        assert parsed.count is None

    def test_a_count_unit_keeps_the_number_as_a_count(self) -> None:
        parsed = parse("2 dozen anday")
        assert parsed.count == 2
        assert parsed.unit == "dozen"
        assert parsed.size is None

    def test_a_multiplier_and_a_size_are_read_separately(self) -> None:
        # "2 x 1kg atta" is two one-kilo bags, and both facts have to survive.
        parsed = parse("2 x 1kg atta")
        assert parsed.count == 2
        assert parsed.size == 1
        assert parsed.unit == "kg"

    def test_a_comma_decimal_is_accepted(self) -> None:
        # OCR reads a full stop as a comma constantly.
        assert parse("1,5 kg atta").size == 1.5


class TestUrduInput:
    @pytest.mark.parametrize(
        ("line", "count", "size", "unit"),
        [
            ("۲ دودھ", 2, None, None),
            ("۱ کلو چینی", None, 1, "kg"),
            ("۱ درجن انڈے", 1, None, "dozen"),
            ("۵ کلو چاول", None, 5, "kg"),
        ],
    )
    def test_urdu_numerals_and_units_parse(
        self, line: str, count: float | None, size: float | None, unit: str | None
    ) -> None:
        parsed = parse(line)
        assert parsed.count == count
        assert parsed.size == size
        assert parsed.unit == unit


class TestUnknownUnits:
    def test_an_unrecognised_unit_is_left_for_the_matcher(self) -> None:
        # Section 14: do not guess. The word stays in the text and the number
        # is read as a count, which the shopper can see and correct.
        parsed = parse("2 tola saffron")
        assert parsed.unit is None
        assert parsed.count == 2


class TestClamping:
    def test_no_count_means_one(self) -> None:
        assert clamp_count(None) == (1, False)

    def test_zero_and_fractions_become_one_and_are_flagged(self) -> None:
        assert clamp_count(0) == (1, True)
        assert clamp_count(0.5) == (1, True)

    def test_an_implausible_count_is_capped_and_flagged(self) -> None:
        # A misread, not an order. The flag is what lets the UI say so.
        assert clamp_count(1000) == (MAX_QUANTITY, True)

    def test_a_plausible_count_passes_through_unflagged(self) -> None:
        assert clamp_count(3) == (3, False)

    def test_an_implausible_size_is_dropped_rather_than_capped(self) -> None:
        # Capping would invent a pack size nobody asked for; dropping it lets
        # the item still match on its name.
        assert clamp_size(500_000) is None
        assert clamp_size(0) is None
        assert clamp_size(1.5) == 1.5
