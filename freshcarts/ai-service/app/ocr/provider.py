"""The OCR engine seam.

Section 8: nothing outside this package may know which engine is running. The
pipeline depends on `OcrProvider`; swapping Tesseract for a cloud vision API or
an ONNX model means adding one class and one name to the registry, and changes
nothing else in the service - and nothing at all in NestJS, which never learns
the engine's name.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol, runtime_checkable

from PIL.Image import Image


@dataclass(frozen=True)
class OcrLine:
    """One line of text the engine found.

    `confidence` is the engine's own number rescaled to 0..1, or None when the
    engine does not report one. None is not zero and must never be rendered as
    a percentage - see section 11.
    """

    text: str
    confidence: float | None = None


@dataclass(frozen=True)
class OcrResult:
    """Raw engine output. Deliberately unprocessed.

    Section 10: this is the text as the engine read it. Normalisation, item
    extraction and everything else happen downstream, so a bad extraction can
    always be traced back to what was actually on the page.
    """

    #: The full text, lines joined by newlines.
    text: str
    lines: list[OcrLine] = field(default_factory=list)
    #: Mean confidence across recognised words, or None when unreported.
    confidence: float | None = None
    #: The engine that produced this, for logs and health only. Never reaches a
    #: customer-facing surface.
    engine: str = "unknown"
    #: Language packs the engine actually used.
    languages: tuple[str, ...] = ()


@runtime_checkable
class OcrProvider(Protocol):
    """What every OCR engine must offer, and all the pipeline may assume."""

    @property
    def name(self) -> str:
        """Short engine identifier, e.g. "tesseract"."""
        ...

    def is_available(self) -> bool:
        """True when the engine can actually run right now.

        Probed rather than assumed: an engine that needs a system binary can be
        absent on a machine where the Python package is installed, and the
        honest answer then is a 503, not a fabricated empty result.
        """
        ...

    def extract_text(self, image: Image) -> OcrResult:
        """Reads `image` and returns what is on it.

        Raises OcrEngineUnavailableError / OcrEngineFailedError /
        OcrEngineTimeoutError. Returning empty text is a legitimate answer and
        is NOT an error - an unreadable photo and a blank page are different
        things, and the pipeline distinguishes them.
        """
        ...
