"""Typed configuration for the AI service.

Every value the service needs is read here and nowhere else, so behaviour is
auditable in one place and testable by constructing a Settings object rather
than mutating the process environment.
"""

from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration, loaded from the environment and `.env`."""

    model_config = SettingsConfigDict(
        env_file=(".env.local", ".env"),
        env_prefix="AI_",
        extra="ignore",
    )

    environment: str = "development"
    host: str = "127.0.0.1"
    port: int = 8000

    # --- OCR engine ------------------------------------------------------
    # Which implementation of OcrProvider answers "what text is in this image?".
    # The name is resolved by app.ocr.registry; adding an engine means adding a
    # class and a name here, not touching the pipeline.
    ocr_provider: str = "tesseract"

    #: Absolute path to the Tesseract binary. Empty means "on PATH".
    tesseract_cmd: str = ""

    #: Tesseract language packs, in the order it should try them. `urd` is what
    #: makes an Urdu-script list readable at all; without it such a list comes
    #: back as noise, and the service says so rather than guessing.
    tesseract_languages: str = "eng+urd"

    #: Directory holding the .traineddata files. Empty means Tesseract's own.
    #:
    #: Worth configuring rather than relying on the default: the Windows and
    #: Debian installers ship English only, and adding a language to their
    #: install directory needs root. Pointing this at a directory the service
    #: owns makes the language packs part of the deployment rather than a
    #: manual step somebody has to remember on every new machine.
    tesseract_data_path: str = ""

    #: Page segmentation mode. 6 = "a single uniform block of text", which is
    #: what a grocery list is. The default (3, full auto page segmentation)
    #: hunts for columns and headers that a shopping list does not have.
    tesseract_psm: int = 6

    #: Hard ceiling on how long the engine may run for one image.
    ocr_timeout_seconds: float = 20.0

    # --- Image limits ----------------------------------------------------
    #: Refused above this. Mirrored by the NestJS upload guard, which rejects
    #: an oversized file before it ever reaches this service.
    max_image_bytes: int = 8 * 1024 * 1024

    #: Below this the image cannot contain legible handwriting; §59 asks us to
    #: say "the image is hard to read" rather than return an empty result.
    min_image_dimension: int = 80

    #: Guards against a decompression bomb: a small file that expands into a
    #: multi-gigapixel bitmap. Pillow is also told this limit directly.
    max_image_pixels: int = 40_000_000

    #: Images larger than this on their long edge are downscaled before OCR.
    #: Beyond roughly this width Tesseract gets slower without getting better.
    ocr_target_long_edge: int = 2000

    # --- Extraction limits -----------------------------------------------
    #: A grocery list longer than this is almost certainly not a grocery list.
    max_items: int = 60

    #: Lines shorter than this after normalisation carry no item.
    min_line_length: int = 2

    log_level: str = Field(default="INFO")

    @property
    def is_production(self) -> bool:
        return self.environment == "production"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Process-wide settings. Cached so the environment is read once."""
    return Settings()
