"""Shared test fixtures.

The OCR engine is replaced by a fake in every test that goes through the HTTP
layer. That is not a shortcut: it is the only way to assert on the pipeline's
behaviour deterministically. Real Tesseract output varies with version, language
pack and rendering, so a test that depended on it would be testing the engine
rather than this service - and would be a machine-dependent failure waiting to
happen in CI.
"""

from __future__ import annotations

import io
from dataclasses import dataclass, field

import pytest
from fastapi.testclient import TestClient
from PIL import Image, ImageDraw

from app.core.config import Settings
from app.main import create_app
from app.ocr.provider import OcrLine, OcrResult
from app.services.ocr_service import OcrService


@dataclass
class FakeOcrProvider:
    """An OcrProvider that returns whatever the test tells it to."""

    text: str = ""
    line_confidences: list[float | None] = field(default_factory=list)
    confidence: float | None = 0.92
    available: bool = True
    error: Exception | None = None
    missing: tuple[str, ...] = ()
    calls: int = 0

    @property
    def name(self) -> str:
        return "fake"

    def is_available(self) -> bool:
        return self.available

    def missing_languages(self) -> tuple[str, ...]:
        return self.missing

    def describe(self) -> dict:
        return {"engine": self.name, "available": self.available, "version": "test"}

    def extract_text(self, image) -> OcrResult:  # noqa: ANN001 - matches the protocol
        self.calls += 1

        if self.error is not None:
            raise self.error

        lines = self.text.splitlines()
        confidences = self.line_confidences or [self.confidence] * len(lines)

        return OcrResult(
            text=self.text,
            lines=[
                OcrLine(text=line, confidence=confidences[index] if index < len(confidences) else None)
                for index, line in enumerate(lines)
            ],
            confidence=self.confidence,
            engine=self.name,
            languages=("eng", "urd"),
        )


@pytest.fixture
def settings() -> Settings:
    return Settings(environment="test")


@pytest.fixture
def provider() -> FakeOcrProvider:
    return FakeOcrProvider()


@pytest.fixture
def client(provider: FakeOcrProvider, settings: Settings) -> TestClient:
    app = create_app()

    # `raise_server_exceptions=False` so an unhandled exception is rendered by
    # the application's own handler and can be asserted on, rather than being
    # re-raised into the test. That is what a real client would receive.
    with TestClient(app, raise_server_exceptions=False) as test_client:
        # Replace the real service after startup, so the lifespan hook has run
        # and this override is what every request actually sees.
        test_client.app.state.ocr_service = OcrService(provider, settings)
        yield test_client


def make_image(
    *,
    width: int = 600,
    height: int = 400,
    fmt: str = "PNG",
    blank: bool = False,
) -> bytes:
    """A real encoded image, so the validation path is exercised for real."""
    image = Image.new("RGB", (width, height), "white")

    if not blank:
        # Enough tonal variation to pass the blank-frame check.
        draw = ImageDraw.Draw(image)
        for offset in range(0, height, 24):
            draw.line([(20, offset), (width - 20, offset)], fill="black", width=3)

    buffer = io.BytesIO()
    image.save(buffer, format=fmt)
    return buffer.getvalue()


def upload(client: TestClient, data: bytes, *, filename: str = "list.png", content_type: str = "image/png"):
    return client.post(
        "/api/v1/ocr/grocery-list",
        files={"image": (filename, data, content_type)},
    )
