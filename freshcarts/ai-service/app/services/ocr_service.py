"""The OCR pipeline, end to end.

    bytes -> validate -> preprocess -> engine -> normalise -> extract -> respond

Each step is a function elsewhere; this file is the order they run in and the
decisions between them. Keeping it thin is the point - the interesting logic is
individually testable, and the orchestration is readable in one screen.
"""

from __future__ import annotations

import logging
import time

from app.core.config import Settings
from app.core.errors import ImageUnreadableError
from app.core.logging import get_request_id
from app.ocr.provider import OcrProvider
from app.schemas.ocr import (
    CONTRACT_VERSION,
    ExtractedItemSchema,
    GroceryListResponse,
    OcrDiagnostics,
)
from app.services import confidence as confidence_module
from app.services.image_service import (
    is_too_small,
    load_image,
    looks_blank,
    prepare_for_ocr,
)
from app.services.item_extractor import ExtractedItem, extract_items
from app.services.normalization import contains_non_ascii_digits, detect_script

logger = logging.getLogger(__name__)


class OcrService:
    """Reads a grocery list image and returns structured items."""

    def __init__(self, provider: OcrProvider, settings: Settings) -> None:
        self._provider = provider
        self._settings = settings

    @property
    def provider(self) -> OcrProvider:
        return self._provider

    def read_grocery_list(self, data: bytes) -> GroceryListResponse:
        started = time.perf_counter()
        settings = self._settings

        image = load_image(
            data,
            max_bytes=settings.max_image_bytes,
            max_pixels=settings.max_image_pixels,
        )

        # Both checks are about the picture, not the groceries, so they happen
        # before the expensive step and produce advice the shopper can act on.
        if is_too_small(image, minimum=settings.min_image_dimension):
            raise ImageUnreadableError(
                "That image is too small to read. Try taking a clearer, closer photo."
            )

        if looks_blank(image):
            raise ImageUnreadableError(
                "We could not see anything on that image. Try taking a clearer photo in better light."
            )

        prepared = prepare_for_ocr(image, target_long_edge=settings.ocr_target_long_edge)

        try:
            result = self._provider.extract_text(prepared)
        finally:
            # Release the decoded bitmaps as soon as the engine is done rather
            # than waiting for the request to end. On an 8 MB photo these are
            # tens of megabytes, and several concurrent scans add up.
            prepared.close()
            image.close()

        extraction = extract_items(
            result.text,
            line_confidences=[line.confidence for line in result.lines],
            max_items=settings.max_items,
            min_line_length=settings.min_line_length,
        )

        # Only now, with both signals in hand, can "the photo was unreadable" be
        # distinguished from "the photo was fine and had no groceries on it".
        if confidence_module.is_unreadable(
            result.confidence, extracted_items=len(extraction.items)
        ):
            raise ImageUnreadableError(
                "The writing on that image is difficult to read. Try taking a clearer photo."
            )

        warnings = list(extraction.warnings)
        warnings.extend(self._engine_warnings())

        elapsed_ms = int((time.perf_counter() - started) * 1000)

        logger.info(
            "OCR completed",
            extra={
                "context": {
                    "engine": result.engine,
                    "itemCount": len(extraction.items),
                    "skippedLines": extraction.skipped_lines,
                    "confidenceBand": confidence_module.band(result.confidence).value,
                    "durationMs": elapsed_ms,
                }
            },
        )

        return GroceryListResponse(
            version=CONTRACT_VERSION,
            requestId=get_request_id(),
            language=_detect_language(result.text, extraction.items),
            rawText=result.text,
            items=[_to_schema(item) for item in extraction.items],
            warnings=warnings,
            diagnostics=OcrDiagnostics(
                engineConfidence=confidence_module.clamp(result.confidence),
                confidenceBand=confidence_module.band(result.confidence).value,
                lineCount=len(result.lines),
                skippedLineCount=extraction.skipped_lines,
                processingMs=elapsed_ms,
            ),
        )

    def _engine_warnings(self) -> list[str]:
        """Tells the caller when the engine is running degraded.

        A missing `urd` pack does not fail the request - an English list still
        reads fine - but it does mean an Urdu list will come back as noise, and
        silently returning that noise would be the dishonest option.
        """
        missing = getattr(self._provider, "missing_languages", None)

        if not callable(missing):
            return []

        absent = missing()
        if not absent:
            return []

        return [
            "Urdu handwriting may not be read accurately on this server."
            if "urd" in absent
            else "Some language support is missing on this server."
        ]


def _detect_language(text: str, items: list[ExtractedItem]) -> str:
    """Which script the list was written in.

    A script judgement, not a language-identification model - and named
    honestly as such. It exists so the review screen can set `lang` and `dir`
    correctly (section 50), which is a rendering decision that only needs to
    know Urdu from Latin.
    """
    scripts = {item.script for item in items}
    scripts.discard("unknown")

    if not scripts:
        overall = detect_script(text)
        if overall == "urdu":
            return "ur"
        if overall == "latin":
            return "en"
        if overall == "mixed":
            return "mixed"
        # Numerals alone still tell us something.
        return "ur" if contains_non_ascii_digits(text) else "unknown"

    if scripts == {"urdu"}:
        return "ur"
    if scripts == {"latin"}:
        return "en"
    return "mixed"


def _to_schema(item: ExtractedItem) -> ExtractedItemSchema:
    return ExtractedItemSchema(
        rawText=item.raw_text[:200],
        normalizedName=item.normalized_name[:200],
        quantity=item.quantity,
        unit=item.unit,
        unitValue=item.unit_value,
        brand=item.brand,
        qualifiers=list(item.qualifiers),
        confidence=confidence_module.clamp(item.confidence),
        recognized=item.recognized,
        quantityAdjusted=item.quantity_adjusted,
        script=item.script,  # type: ignore[arg-type]
    )
