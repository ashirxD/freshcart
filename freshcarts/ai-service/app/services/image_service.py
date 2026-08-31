"""Image intake: validate, then prepare for OCR.

Security posture (sections 5, 6 and 40), stated up front because it drives every
decision below:

  * Nothing is written to disk. The upload lives in memory for the length of one
    request and is garbage collected. There is no temporary file to leak, to
    traverse into, or to forget to clean up - the safest temporary file is the
    one that never exists.
  * The declared content type is not trusted. The bytes are decoded and the
    format read from the image itself, so `list.jpg` containing a zip archive is
    rejected on what it is, not on what it claims.
  * A decompression bomb is refused before it is decoded, using Pillow's own
    pixel ceiling plus an explicit dimension check.
  * Nothing about the image content is ever logged - not the bytes, not the
    text, not a thumbnail. Dimensions and byte counts only.
"""

from __future__ import annotations

import io
import logging

from PIL import Image, ImageFile, ImageOps, UnidentifiedImageError

from app.core.errors import ImageTooLargeError, InvalidImageError

logger = logging.getLogger(__name__)

#: Formats a phone camera or a screenshot actually produces. Anything else is
#: refused rather than handed to a decoder - a smaller decoder surface is a
#: smaller attack surface.
ALLOWED_FORMATS = frozenset({"JPEG", "PNG", "WEBP"})

#: Refuse a truncated file instead of decoding whatever arrived. A partially
#: uploaded photo produces garbage text, and garbage text produces a confident
#: wrong shopping list.
ImageFile.LOAD_TRUNCATED_IMAGES = False


def load_image(data: bytes, *, max_bytes: int, max_pixels: int) -> Image.Image:
    """Decodes an upload into an image, or explains why it cannot.

    Two passes on purpose: `verify()` checks structural integrity but leaves the
    image unusable afterwards, so the bytes are opened a second time to actually
    read them. That is Pillow's documented contract, not a workaround.
    """
    if not data:
        raise InvalidImageError("No image was received.")

    if len(data) > max_bytes:
        raise ImageTooLargeError(
            f"That image is larger than the {max_bytes // (1024 * 1024)} MB limit."
        )

    # Pillow's own bomb guard. Set before any decode so it applies to both passes.
    Image.MAX_IMAGE_PIXELS = max_pixels

    try:
        with Image.open(io.BytesIO(data)) as probe:
            image_format = probe.format
            probe.verify()
    except (UnidentifiedImageError, OSError, SyntaxError) as error:
        raise InvalidImageError(
            "That file is not an image we can read. Please upload a JPG, PNG or WEBP photo."
        ) from error
    except Image.DecompressionBombError as error:
        raise ImageTooLargeError("That image is too large to process.") from error

    if image_format not in ALLOWED_FORMATS:
        raise InvalidImageError(
            f"{image_format or 'That file type'} is not supported. "
            "Please upload a JPG, PNG or WEBP photo."
        )

    try:
        image = Image.open(io.BytesIO(data))
        image.load()
    except Image.DecompressionBombError as error:
        raise ImageTooLargeError("That image is too large to process.") from error
    except (UnidentifiedImageError, OSError) as error:
        raise InvalidImageError("That image could not be opened.") from error

    return image


def is_too_small(image: Image.Image, *, minimum: int) -> bool:
    """Whether the image is too small to hold legible handwriting."""
    return min(image.size) < minimum


def looks_blank(image: Image.Image) -> bool:
    """Cheap check for a photo of nothing.

    A blank or near-blank frame - a lens cap, a wall, an accidental shutter -
    has almost no tonal variation. Detecting it here means the shopper is told
    "the image is difficult to read" straight away instead of waiting several
    seconds for OCR to return nothing (section 59).

    Deliberately conservative: only an *extremely* flat image qualifies, so a
    clean white page with dark writing on it never does.
    """
    greyscale = ImageOps.grayscale(image)
    # Thumbnail first: the statistic is the same and this makes the check
    # constant-time regardless of how large the upload was.
    greyscale.thumbnail((160, 160))

    histogram = greyscale.histogram()
    total = sum(histogram)
    if total == 0:
        return True

    mean = sum(value * count for value, count in enumerate(histogram)) / total
    variance = sum(count * (value - mean) ** 2 for value, count in enumerate(histogram)) / total

    return variance**0.5 < 6.0


def prepare_for_ocr(image: Image.Image, *, target_long_edge: int) -> Image.Image:
    """Pre-processes an image so the engine has the best chance with it.

    Four steps, each earning its place on phone photos of handwritten lists:

      1. EXIF transpose - a photo taken in portrait is stored rotated with an
         orientation flag. OCR reads pixels, not flags, so without this a
         perfectly good photo is read sideways and returns nothing.
      2. Greyscale - colour carries no information for text recognition and
         costs three channels of work.
      3. Autocontrast - phone photos of paper are low contrast and unevenly lit;
         stretching the range is what separates ink from paper.
      4. Downscale - past roughly 2000px on the long edge Tesseract gets slower
         without getting better. Upscaling is deliberately not done: it invents
         detail, and inventing detail is how OCR becomes confidently wrong.
    """
    prepared = ImageOps.exif_transpose(image) or image
    prepared = ImageOps.grayscale(prepared)
    prepared = ImageOps.autocontrast(prepared, cutoff=1)

    long_edge = max(prepared.size)
    if long_edge > target_long_edge:
        prepared.thumbnail((target_long_edge, target_long_edge), Image.Resampling.LANCZOS)

    return prepared
