"""Grocery item extraction (sections 10, 12 and 51)."""

from __future__ import annotations

import pytest

from app.services.item_extractor import extract_item, extract_items


class TestSectionTwelveExamples:
    """The worked examples from section 12, asserted literally."""

    def test_two_milk(self) -> None:
        item = extract_item("2 milk")
        assert (item.normalized_name, item.quantity) == ("milk", 2)

    def test_five_kg_basmati_rice(self) -> None:
        item = extract_item("5 kg basmati rice")
        # "basmati" must survive: it is what tells one bag of rice from another.
        assert item.normalized_name == "basmati rice"
        assert item.unit == "kg"
        assert item.unit_value == 5

    def test_olpers_milk_two(self) -> None:
        item = extract_item("Olper's milk 2")
        assert item.normalized_name == "milk"
        assert item.brand == "Olper's"
        assert item.quantity == 2

    def test_one_dozen_eggs(self) -> None:
        item = extract_item("1 dozen eggs")
        assert (item.normalized_name, item.quantity, item.unit) == ("eggs", 1, "dozen")


class TestSectionFourLists:
    """The four list styles section 4 says must work."""

    @pytest.mark.parametrize(
        ("line", "name", "quantity"),
        [
            # English
            ("2 Milk", "milk", 2),
            ("1 kg Sugar", "sugar", 1),
            ("1 dozen Eggs", "eggs", 1),
            ("2 Bread", "bread", 2),
            # Roman Urdu
            ("2 doodh", "milk", 2),
            ("1 kg cheeni", "sugar", 1),
            ("1 dozen anday", "eggs", 1),
            # Urdu script
            ("۲ دودھ", "milk", 2),
            ("۱ کلو چینی", "sugar", 1),
            ("۱ درجن انڈے", "eggs", 1),
            ("۲ ڈبل روٹی", "bread", 2),
            # Mixed, with the quantity in an awkward place
            ("anday 1 dozen", "eggs", 1),
            ("Surf 1", "detergent", 1),
        ],
    )
    def test_lines_extract(self, line: str, name: str, quantity: int) -> None:
        item = extract_item(line)
        assert item is not None
        assert item.normalized_name == name
        assert item.quantity == quantity


class TestRawTextIsPreserved:
    def test_the_original_line_is_carried_untouched(self) -> None:
        # Section 10: raw OCR and structured items are different things, and the
        # raw text is what makes a wrong match explainable to the shopper.
        item = extract_item("  ۲ دودھ  ")
        assert item.raw_text == "۲ دودھ"
        assert item.normalized_name == "milk"

    def test_the_script_is_recorded_for_rendering(self) -> None:
        # Drives lang/dir on the review screen (section 50).
        assert extract_item("۲ دودھ").script == "urdu"
        assert extract_item("2 milk").script == "latin"


class TestUnknownItems:
    def test_an_unknown_word_is_passed_through_rather_than_dropped(self) -> None:
        # The vocabulary does not know it; the catalogue still might.
        item = extract_item("2 zafraan")
        assert item.normalized_name == "zafraan"
        assert item.recognized is False

    def test_a_known_word_is_marked_recognised(self) -> None:
        assert extract_item("2 doodh").recognized is True


class TestNoise:
    @pytest.mark.parametrize("line", ["Grocery List", "---", "12", "", "  ", "•"])
    def test_headings_and_scribbles_produce_no_item(self, line: str) -> None:
        assert extract_item(line) is None

    def test_qualifiers_are_kept_out_of_the_name_but_recorded(self) -> None:
        item = extract_item("fresh doodh")
        assert item.normalized_name == "milk"
        assert item.qualifiers == ("fresh",)

    def test_a_qualifier_alone_still_becomes_an_item(self) -> None:
        # However unhelpful, it is the whole of what the shopper wrote.
        item = extract_item("2 brown")
        assert item is not None
        assert item.normalized_name == "brown"


class TestWholeLists:
    def test_a_list_extracts_in_order(self) -> None:
        result = extract_items("2 doodh\n1 kg cheeni\nanday 1 dozen")
        assert [item.normalized_name for item in result.items] == ["milk", "sugar", "eggs"]

    def test_headings_are_counted_as_skipped_not_returned(self) -> None:
        result = extract_items("Grocery List\n2 doodh\n---")
        assert len(result.items) == 1
        assert result.skipped_lines == 2

    def test_the_same_item_written_twice_is_merged(self) -> None:
        # What a shopper means by writing "milk" at the top and "2 milk" later.
        result = extract_items("milk\n2 milk")
        assert len(result.items) == 1
        assert result.items[0].quantity == 3

    def test_different_pack_sizes_stay_separate(self) -> None:
        # 1 kg atta and 5 kg atta are two different products, not one line of six.
        result = extract_items("1 kg atta\n5 kg atta")
        assert len(result.items) == 2

    def test_a_comma_separated_line_becomes_several_items(self) -> None:
        result = extract_items("milk, eggs, bread")
        assert len(result.items) == 3

    def test_an_absurdly_long_list_is_truncated_with_a_warning(self) -> None:
        result = extract_items("\n".join(f"2 zzz{chr(97 + n)}" for n in range(11)), max_items=5)
        assert len(result.items) == 5
        assert any("first 5" in warning for warning in result.warnings)

    def test_line_confidence_is_carried_onto_the_item(self) -> None:
        result = extract_items("2 doodh\n1 kg cheeni", line_confidences=[0.91, 0.42])
        assert result.items[0].confidence == pytest.approx(0.91)
        assert result.items[1].confidence == pytest.approx(0.42)

    def test_an_unreported_confidence_stays_unknown(self) -> None:
        # Section 11: never invent a number the engine did not give.
        result = extract_items("2 doodh", line_confidences=[None])
        assert result.items[0].confidence is None
