"""The one endpoint that matters: read a grocery list image.

Internal API. It is called by the FreshCarts NestJS API, which has already
authenticated the shopper, rate limited them, and checked the file - this
service should not be reachable from the internet at all (section 40). It
nonetheless validates everything it receives, because "the caller checked"
is not a security control.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, File, UploadFile

from app.api.deps import get_ocr_service
from app.core.config import Settings, get_settings
from app.core.errors import ImageTooLargeError, InvalidImageError
from app.schemas.ocr import GroceryListResponse
from app.services.ocr_service import OcrService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/ocr", tags=["ocr"])


@router.post(
    "/grocery-list",
    response_model=GroceryListResponse,
    response_model_by_alias=True,
    summary="Extract grocery items from a photo of a shopping list",
)
async def read_grocery_list(
    image: UploadFile = File(..., description="JPEG, PNG or WEBP photo of a grocery list"),
    service: OcrService = Depends(get_ocr_service),
    settings: Settings = Depends(get_settings),
) -> GroceryListResponse:
    if image is None or not image.filename:
        raise InvalidImageError("No image was received.")

    # Read at most one byte more than the limit. Reading the whole stream first
    # and measuring afterwards would let an oversized upload consume the memory
    # the limit exists to protect.
    data = await image.read(settings.max_image_bytes + 1)

    if len(data) > settings.max_image_bytes:
        raise ImageTooLargeError(
            f"That image is larger than the {settings.max_image_bytes // (1024 * 1024)} MB limit."
        )

    logger.info(
        "OCR started",
        extra={"context": {"bytes": len(data), "contentType": image.content_type}},
    )

    # Deliberately no try/except: every failure this can raise is an
    # AiServiceError with a code and a status, and main.py renders all of them
    # through one handler. Catching here would mean two places deciding how a
    # failure looks.
    return service.read_grocery_list(data)
