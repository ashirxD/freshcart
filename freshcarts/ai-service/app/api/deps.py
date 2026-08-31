"""Dependency wiring.

The provider and the service are built once at startup and stored on the app
state, so a request never pays for constructing them and a test can replace them
wholesale by assigning to `app.state`.
"""

from __future__ import annotations

from fastapi import Request

from app.services.ocr_service import OcrService


def get_ocr_service(request: Request) -> OcrService:
    """The configured OcrService for this application instance."""
    return request.app.state.ocr_service
