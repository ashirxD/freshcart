"""Chooses the OCR engine from configuration.

The whole of the rest of the service asks for an `OcrProvider` and gets one.
This is the single place a provider name becomes a class, so adding an engine is
a two-line change here plus the class itself.
"""

from __future__ import annotations

from typing import Callable

from app.core.config import Settings
from app.ocr.provider import OcrProvider
from app.ocr.tesseract_provider import TesseractOcrProvider


def _build_tesseract(settings: Settings) -> OcrProvider:
    return TesseractOcrProvider(
        languages=settings.tesseract_languages,
        psm=settings.tesseract_psm,
        timeout_seconds=settings.ocr_timeout_seconds,
        binary_path=settings.tesseract_cmd,
        data_path=settings.tesseract_data_path,
    )


#: Name -> factory. A dict rather than an if/elif chain so the set of engines is
#: readable at a glance and testable without importing every implementation.
PROVIDERS: dict[str, Callable[[Settings], OcrProvider]] = {
    "tesseract": _build_tesseract,
}


def build_ocr_provider(settings: Settings) -> OcrProvider:
    """Instantiates the configured provider.

    An unknown name fails loudly at startup. Silently falling back to a default
    would mean a typo in AI_OCR_PROVIDER quietly changes which engine reads
    customers' shopping lists.
    """
    factory = PROVIDERS.get(settings.ocr_provider)

    if factory is None:
        known = ", ".join(sorted(PROVIDERS))
        raise ValueError(
            f"Unknown AI_OCR_PROVIDER '{settings.ocr_provider}'. Known providers: {known}"
        )

    return factory(settings)
