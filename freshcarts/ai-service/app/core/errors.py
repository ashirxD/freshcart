"""Domain failures, and the stable codes they travel to NestJS under.

These codes are a contract. NestJS maps them onto shopper-facing copy, so
renaming one is a breaking change; the human-readable message beside them can be
reworded freely, which is exactly why the code exists separately.
"""

from __future__ import annotations

from enum import Enum


class OcrErrorCode(str, Enum):
    """Machine-readable reasons an OCR request could not be answered."""

    #: The upload is not a supported image, or is corrupt.
    INVALID_IMAGE = "INVALID_IMAGE"
    #: Larger than the configured ceiling.
    IMAGE_TOO_LARGE = "IMAGE_TOO_LARGE"
    #: Decodable, but too small or too blank to hold a readable list.
    IMAGE_UNREADABLE = "IMAGE_UNREADABLE"
    #: The OCR engine is not installed or not reachable.
    ENGINE_UNAVAILABLE = "ENGINE_UNAVAILABLE"
    #: The engine ran but failed.
    ENGINE_FAILED = "ENGINE_FAILED"
    #: The engine exceeded its time budget.
    ENGINE_TIMEOUT = "ENGINE_TIMEOUT"


class AiServiceError(Exception):
    """Base class for every failure this service reports deliberately.

    Carries an HTTP status so the route layer does not have to re-decide it, and
    a code so the caller does not have to parse prose.
    """

    code: OcrErrorCode = OcrErrorCode.ENGINE_FAILED
    status_code: int = 500

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class InvalidImageError(AiServiceError):
    code = OcrErrorCode.INVALID_IMAGE
    status_code = 400


class ImageTooLargeError(AiServiceError):
    code = OcrErrorCode.IMAGE_TOO_LARGE
    status_code = 413


class ImageUnreadableError(AiServiceError):
    """The image decoded, but there is nothing an OCR engine could read.

    A distinct failure from "OCR found no groceries": this one is about the
    picture, and the honest advice is "take a clearer photo" (§59).
    """

    code = OcrErrorCode.IMAGE_UNREADABLE
    status_code = 422


class OcrEngineUnavailableError(AiServiceError):
    """The engine is not installed or cannot be started.

    Reported as 503 rather than 500 so the caller can tell "this service is
    misconfigured" apart from "this image broke it".
    """

    code = OcrErrorCode.ENGINE_UNAVAILABLE
    status_code = 503


class OcrEngineFailedError(AiServiceError):
    code = OcrErrorCode.ENGINE_FAILED
    status_code = 502


class OcrEngineTimeoutError(AiServiceError):
    code = OcrErrorCode.ENGINE_TIMEOUT
    status_code = 504
