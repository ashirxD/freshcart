"""Liveness and configuration diagnostics.

Reports whether the OCR engine is genuinely usable, not merely whether the
process is up. A service that answers requests but has no engine installed is
not healthy, and saying "ok" in that state would hide the one thing an operator
needs to know.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.deps import get_ocr_service
from app.core.config import Settings, get_settings
from app.schemas.ocr import HealthResponse
from app.services.normalization import vocabulary_sizes
from app.services.ocr_service import OcrService

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
def health(
    service: OcrService = Depends(get_ocr_service),
    settings: Settings = Depends(get_settings),
) -> HealthResponse:
    provider = service.provider
    describe = getattr(provider, "describe", None)

    ocr = (
        describe()
        if callable(describe)
        else {"engine": provider.name, "available": provider.is_available()}
    )

    return HealthResponse(
        # "degraded" rather than a 503: the process is alive and its other
        # endpoints work. An orchestrator should not restart it for this - a
        # restart will not install the missing binary.
        status="ok" if ocr.get("available") else "degraded",
        environment=settings.environment,
        ocr=ocr,
        vocabulary=vocabulary_sizes(),
    )
