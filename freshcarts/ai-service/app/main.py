"""FreshCarts AI service.

An internal service with one job: turn a photo of a grocery list into
structured grocery items. It holds no database connection, no catalogue, no
prices and no customer identity - by design (section 0). It returns
intelligence; NestJS decides what to do with it.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.api.routes import health, ocr
from app.core.config import get_settings
from app.core.errors import AiServiceError, OcrErrorCode
from app.core.logging import configure_logging, get_request_id, set_request_id
from app.ocr.registry import build_ocr_provider
from app.schemas.ocr import CONTRACT_VERSION, ErrorResponse
from app.services.ocr_service import OcrService

logger = logging.getLogger(__name__)

#: NestJS sends its correlation id under this header (section 72).
REQUEST_ID_HEADER = "X-Request-Id"


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    configure_logging(settings.log_level)

    provider = build_ocr_provider(settings)
    app.state.ocr_service = OcrService(provider, settings)

    available = provider.is_available()
    logger.info(
        "AI service starting",
        extra={
            "context": {
                "environment": settings.environment,
                "provider": provider.name,
                "engineAvailable": available,
                "contractVersion": CONTRACT_VERSION,
            }
        },
    )

    if not available:
        # A warning, not a crash. The health endpoint reports it, NestJS
        # degrades gracefully, and the rest of FreshCarts is unaffected
        # (section 37) - refusing to start would help nobody.
        logger.warning(
            "The OCR engine is not available. Scanning will fail until it is installed."
        )

    yield


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="FreshCarts AI Service",
        version=CONTRACT_VERSION,
        description="OCR and grocery-item extraction for the FreshCarts grocery-list scanner.",
        lifespan=lifespan,
        # No CORS middleware anywhere in this file: browsers must not call this
        # service. The only permitted caller is the NestJS API.
    )

    @app.middleware("http")
    async def correlation_id(request: Request, call_next):
        """Adopts the caller's request id so one id spans all three tiers."""
        request_id = set_request_id(request.headers.get(REQUEST_ID_HEADER))
        response = await call_next(request)
        response.headers[REQUEST_ID_HEADER] = request_id
        return response

    @app.exception_handler(AiServiceError)
    async def handle_service_error(_: Request, error: AiServiceError) -> JSONResponse:
        logger.warning(
            "OCR request failed",
            extra={"context": {"code": error.code.value, "status": error.status_code}},
        )
        return _error_response(error.status_code, error.code.value, error.message)

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(_: Request, error: RequestValidationError) -> JSONResponse:
        # The request never reached the pipeline, so the specific problem is a
        # caller bug, not something a shopper can fix. Logged with the field
        # names only - never the body, which contains an image (section 42).
        logger.warning(
            "Rejected a malformed request",
            extra={"context": {"fields": [".".join(map(str, e["loc"])) for e in error.errors()]}},
        )
        return _error_response(
            422,
            OcrErrorCode.INVALID_IMAGE.value,
            "The request did not include a valid image.",
        )

    @app.exception_handler(Exception)
    async def handle_unexpected(_: Request, error: Exception) -> JSONResponse:
        # The traceback goes to the log; the response says nothing about it.
        logger.exception("Unhandled error while processing an OCR request")
        return _error_response(
            500,
            OcrErrorCode.ENGINE_FAILED.value,
            "We could not process the image right now.",
        )

    app.include_router(health.router)
    app.include_router(ocr.router)

    if settings.log_level:
        configure_logging(settings.log_level)

    return app


def _error_response(status_code: int, code: str, message: str) -> JSONResponse:
    body = ErrorResponse(
        version=CONTRACT_VERSION,
        requestId=get_request_id(),
        code=code,
        message=message,
    )
    return JSONResponse(status_code=status_code, content=body.model_dump(by_alias=True))


app = create_app()
