"""The wire contract between the AI service and NestJS (sections 9 and 71).

Everything crossing this boundary is a Pydantic model - never a bare dict.
That is what lets NestJS validate the response against a schema rather than
hoping, and it is what makes the contract something both sides can see.

Versioning: the response carries an explicit `version`. NestJS checks it and
refuses a payload it does not understand, so this contract can evolve without
the two services having to be deployed in lockstep.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

#: Bumped when a change would break a caller that understood the previous shape.
#: Additive changes - a new optional field - do not require a bump.
CONTRACT_VERSION = "1"


class CamelModel(BaseModel):
    """Serialises as camelCase, which is what the TypeScript side reads."""

    model_config = ConfigDict(populate_by_name=True, extra="forbid")


class ExtractedItemSchema(CamelModel):
    """One grocery item read off the list.

    Note what is absent: any product id, any price, any stock figure. This
    service has never seen the catalogue and must not appear to have an opinion
    about it (section 0).
    """

    raw_text: str = Field(
        alias="rawText",
        max_length=200,
        description="Exactly what was on the line, unmodified.",
    )
    normalized_name: str = Field(
        alias="normalizedName",
        max_length=200,
        description="Canonical English name to search the catalogue by.",
    )
    quantity: int = Field(ge=1, le=99, description="Whole number of items requested.")
    unit: str | None = Field(
        default=None,
        max_length=20,
        description="Normalised unit (kg, g, liter, ml, dozen, piece, pack, bottle, box), or null when the line did not give one.",
    )
    unit_value: float | None = Field(
        default=None,
        alias="unitValue",
        gt=0,
        description="The pack size asked for, in `unit` - 500 for '500 g namak'. Distinct from `quantity`, which is how many packs. Null when no size was written.",
    )
    brand: str | None = Field(default=None, max_length=80)
    qualifiers: list[str] = Field(
        default_factory=list,
        description="Descriptive words kept out of the name, e.g. 'fresh', 'brown'.",
    )
    confidence: float | None = Field(
        default=None,
        ge=0.0,
        le=1.0,
        description="How confidently the ENGINE READ THIS LINE. Null when the engine does not report one. Not a product-match confidence.",
    )
    recognized: bool = Field(
        description="True when the grocery vocabulary knew this word; false when the raw text is being passed through for the catalogue to try.",
    )
    quantity_adjusted: bool = Field(
        default=False,
        alias="quantityAdjusted",
        description="True when the written quantity had to be adjusted (a fraction, a zero, or an implausibly large number).",
    )
    script: Literal["latin", "urdu", "mixed", "unknown"] = "latin"


class OcrDiagnostics(CamelModel):
    """Operational figures for logging and the review screen's honesty.

    Deliberately contains no text from the list.
    """

    engine_confidence: float | None = Field(default=None, alias="engineConfidence", ge=0.0, le=1.0)
    confidence_band: Literal["HIGH", "MEDIUM", "LOW", "UNKNOWN"] = Field(alias="confidenceBand")
    line_count: int = Field(alias="lineCount", ge=0)
    skipped_line_count: int = Field(alias="skippedLineCount", ge=0)
    processing_ms: int = Field(alias="processingMs", ge=0)


class GroceryListResponse(CamelModel):
    """What POST /api/v1/ocr/grocery-list returns."""

    version: str = CONTRACT_VERSION
    request_id: str = Field(alias="requestId", max_length=100)
    language: Literal["en", "ur", "mixed", "unknown"] = Field(
        description="The script the list appears to be written in.",
    )
    raw_text: str = Field(
        alias="rawText",
        max_length=20_000,
        description="The text the engine read, before any interpretation (section 10).",
    )
    items: list[ExtractedItemSchema] = Field(default_factory=list)
    warnings: list[str] = Field(
        default_factory=list,
        description="Things the shopper should know: a truncated list, a missing language pack.",
    )
    diagnostics: OcrDiagnostics


class ErrorResponse(CamelModel):
    """The failure shape. Every non-2xx from this service looks like this."""

    version: str = CONTRACT_VERSION
    request_id: str = Field(alias="requestId")
    code: str = Field(description="Stable machine-readable reason - see OcrErrorCode.")
    message: str = Field(description="Plain sentence explaining the failure.")


class HealthResponse(CamelModel):
    """Liveness plus enough detail to diagnose a misconfigured deployment."""

    status: Literal["ok", "degraded"]
    version: str = CONTRACT_VERSION
    environment: str
    ocr: dict
    vocabulary: dict
