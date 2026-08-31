"""OCR confidence (section 11).

Two rules, and the whole module exists to hold them:

  1. If the engine does not report a confidence, this service does not invent
     one. None travels all the way to the client, which renders "not reported"
     rather than a number nobody measured.

  2. OCR confidence is about *reading the page*. It says nothing about whether
     the right product was found - that is a separate measurement made in
     NestJS against the catalogue, and section 10 is explicit that the two must
     not be conflated.
"""

from __future__ import annotations

from enum import Enum

#: Below this, the page was read so poorly that the honest response is "try a
#: clearer photo" rather than a list of guesses (section 59).
UNREADABLE_THRESHOLD = 0.35

#: Below this the reading is usable but shaky, and the UI says so.
LOW_THRESHOLD = 0.60

HIGH_THRESHOLD = 0.85


class ConfidenceBand(str, Enum):
    """A category, because the underlying number does not justify decimals."""

    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"
    UNKNOWN = "UNKNOWN"


def band(confidence: float | None) -> ConfidenceBand:
    if confidence is None:
        return ConfidenceBand.UNKNOWN
    if confidence >= HIGH_THRESHOLD:
        return ConfidenceBand.HIGH
    if confidence >= LOW_THRESHOLD:
        return ConfidenceBand.MEDIUM
    return ConfidenceBand.LOW


def is_unreadable(confidence: float | None, *, extracted_items: int) -> bool:
    """Whether to report the image as unreadable rather than return a result.

    Confidence alone is not enough to condemn an image: a short list of clear
    words can score modestly, and a confident engine can be confidently wrong.
    So this asks for both signals to agree - the engine was unsure AND nothing
    recognisable came out - before telling the shopper their photo was the
    problem.
    """
    if confidence is None:
        return False

    return confidence < UNREADABLE_THRESHOLD and extracted_items == 0


def clamp(confidence: float | None) -> float | None:
    """Keeps a reported confidence inside 0..1 without inventing one."""
    if confidence is None:
        return None
    return max(0.0, min(1.0, confidence))
