"""Structured logging with a correlation id that follows a request.

§72 asks for one id across frontend -> NestJS -> FastAPI. NestJS generates it
and sends it as `X-Request-Id`; everything logged while handling that request
carries it, so a single grep reconstructs the whole journey.

What is never logged, anywhere in this service: the image bytes, the extracted
text of a shopper's list, or anything else that identifies a person. Sizes,
counts, durations and outcomes only.
"""

from __future__ import annotations

import json
import logging
import sys
import time
import uuid
from contextvars import ContextVar
from typing import Any

#: The id of the request currently being handled. A ContextVar rather than a
#: global because a single worker interleaves requests.
_request_id: ContextVar[str] = ContextVar("request_id", default="-")


def set_request_id(value: str | None) -> str:
    """Adopts the caller's correlation id, or mints one when there is none."""
    resolved = (value or "").strip() or uuid.uuid4().hex
    _request_id.set(resolved)
    return resolved


def get_request_id() -> str:
    return _request_id.get()


class JsonFormatter(logging.Formatter):
    """One JSON object per line: greppable by hand, parseable by a collector."""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime(record.created)),
            "level": record.levelname,
            "logger": record.name,
            "requestId": get_request_id(),
            "message": record.getMessage(),
        }

        # Anything attached with `logger.info(..., extra={"context": {...}})`.
        context = getattr(record, "context", None)
        if isinstance(context, dict):
            payload.update(context)

        if record.exc_info:
            # The type and message, never the traceback: a traceback in a log
            # line is noise here, and the handler already has the exception.
            exc_type, exc_value, _ = record.exc_info
            payload["error"] = getattr(exc_type, "__name__", "Error")
            payload["errorMessage"] = str(exc_value)

        return json.dumps(payload, ensure_ascii=False)


def configure_logging(level: str = "INFO") -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())

    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(level.upper())

    # Uvicorn installs its own handlers; route them through ours so every line
    # in the process has the same shape and carries the correlation id.
    for name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        logger = logging.getLogger(name)
        logger.handlers = [handler]
        logger.propagate = False
