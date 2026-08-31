"""Image intake: validation, safety limits and preprocessing (sections 5, 6, 40)."""

from __future__ import annotations

import io

import pytest
from PIL import Image

from app.core.errors import ImageTooLargeError, InvalidImageError
from app.services.image_service import (
    ALLOWED_FORMATS,
    is_too_small,
    load_image,
    looks_blank,
    prepare_for_ocr,
)
from tests.conftest import make_image

LIMITS = {"max_bytes": 8 * 1024 * 1024, "max_pixels": 40_000_000}


class TestValidation:
    @pytest.mark.parametrize("fmt", sorted(ALLOWED_FORMATS))
    def test_supported_formats_load(self, fmt: str) -> None:
        assert load_image(make_image(fmt=fmt), **LIMITS)

    def test_an_empty_upload_is_refused(self) -> None:
        with pytest.raises(InvalidImageError):
            load_image(b"", **LIMITS)

    def test_arbitrary_bytes_are_refused(self) -> None:
        with pytest.raises(InvalidImageError):
            load_image(b"PK\x03\x04 this is a zip archive", **LIMITS)

    def test_the_declared_extension_is_not_trusted(self) -> None:
        # A shell script named list.jpg is refused on its bytes. The filename
        # never reaches this function precisely because it proves nothing.
        with pytest.raises(InvalidImageError):
            load_image(b"#!/bin/sh\nrm -rf /", **LIMITS)

    def test_an_unsupported_but_valid_image_is_refused_by_format(self) -> None:
        # Narrowing the decoder surface is the point: fewer decoders, fewer
        # decoder bugs reachable from an upload.
        with pytest.raises(InvalidImageError, match="not supported"):
            load_image(make_image(fmt="BMP"), **LIMITS)

    def test_a_truncated_image_is_refused_rather_than_half_decoded(self) -> None:
        # Half a photo produces garbage text, and garbage text produces a
        # confident wrong shopping list.
        data = make_image(fmt="PNG")
        with pytest.raises(InvalidImageError):
            load_image(data[: len(data) // 2], **LIMITS)

    def test_an_oversized_upload_is_refused_by_byte_count(self) -> None:
        with pytest.raises(ImageTooLargeError):
            load_image(make_image(width=800, height=600), max_bytes=64, max_pixels=40_000_000)

    def test_a_decompression_bomb_is_refused_by_pixel_count(self) -> None:
        # A small file that expands into an enormous bitmap - the classic way to
        # exhaust memory through an image upload.
        with pytest.raises(ImageTooLargeError):
            load_image(make_image(width=4000, height=3000), max_bytes=8 * 1024 * 1024, max_pixels=1000)


class TestQualityChecks:
    def test_a_tiny_image_is_flagged(self) -> None:
        image = load_image(make_image(width=40, height=30), **LIMITS)
        assert is_too_small(image, minimum=80)

    def test_a_normal_photo_is_not_flagged_as_too_small(self) -> None:
        image = load_image(make_image(), **LIMITS)
        assert not is_too_small(image, minimum=80)

    def test_a_blank_frame_is_detected(self) -> None:
        assert looks_blank(load_image(make_image(blank=True), **LIMITS))

    def test_a_page_with_writing_on_it_is_not_called_blank(self) -> None:
        # The check has to be conservative: a white page with dark ink on it is
        # exactly what a grocery list looks like.
        assert not looks_blank(load_image(make_image(), **LIMITS))


class TestPreprocessing:
    def test_large_images_are_downscaled(self) -> None:
        image = load_image(make_image(width=4000, height=3000), **LIMITS)
        prepared = prepare_for_ocr(image, target_long_edge=1000)

        assert max(prepared.size) <= 1000

    def test_small_images_are_not_upscaled(self) -> None:
        # Upscaling invents detail, and invented detail is how OCR becomes
        # confidently wrong.
        image = load_image(make_image(width=300, height=200), **LIMITS)
        prepared = prepare_for_ocr(image, target_long_edge=2000)

        assert prepared.size == (300, 200)

    def test_output_is_greyscale(self) -> None:
        prepared = prepare_for_ocr(load_image(make_image(), **LIMITS), target_long_edge=2000)
        assert prepared.mode == "L"

    def test_an_exif_rotated_photo_is_uprighted(self) -> None:
        # A portrait phone photo is stored landscape with an orientation flag.
        # OCR reads pixels, not flags, so without this it is read sideways and
        # returns nothing.
        source = Image.new("RGB", (400, 200), "white")
        buffer = io.BytesIO()
        exif = source.getexif()
        exif[274] = 6  # Orientation: rotate 90 degrees clockwise.
        source.save(buffer, format="JPEG", exif=exif)

        image = load_image(buffer.getvalue(), **LIMITS)
        prepared = prepare_for_ocr(image, target_long_edge=2000)

        assert prepared.size == (200, 400)
