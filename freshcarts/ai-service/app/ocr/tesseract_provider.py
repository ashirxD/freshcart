"""Tesseract implementation of OcrProvider.

Tesseract is the default because it is the only freely available engine with a
trained Urdu model (`urd`), which sections 4 and 50 require: without it an
Urdu-script list comes back as noise. It is a system binary rather than a Python
package, so its absence is a real runtime state - reported honestly here instead
of hidden behind an empty result.

Everything Tesseract-specific - the TSV column names, the -1 confidence
sentinel, the `--psm` flag - stops in this file.
"""

from __future__ import annotations

import logging
import os
from typing import Any

import pytesseract
from PIL.Image import Image

from app.core.errors import (
    OcrEngineFailedError,
    OcrEngineTimeoutError,
    OcrEngineUnavailableError,
)
from app.ocr.provider import OcrLine, OcrResult

logger = logging.getLogger(__name__)

#: Tesseract reports -1 for a box it did not recognise as a word. Averaging that
#: in would silently drag every confidence down.
_UNRECOGNISED = -1


class TesseractOcrProvider:
    """Reads text with the local Tesseract binary."""

    def __init__(
        self,
        *,
        languages: str = "eng",
        psm: int = 6,
        timeout_seconds: float = 20.0,
        binary_path: str = "",
        data_path: str = "",
    ) -> None:
        self._languages = languages
        self._psm = psm
        self._timeout = timeout_seconds

        if binary_path:
            pytesseract.pytesseract.tesseract_cmd = binary_path

        if data_path:
            # TESSDATA_PREFIX rather than the --tessdata-dir flag, deliberately.
            # pytesseract splits its `config` string on plain whitespace, so a
            # Windows path with spaces in it arrives at Tesseract in pieces -
            # and quoting it only bakes the quote marks into the path. The
            # environment variable has neither problem, and it is also what
            # get_languages() consults, so the availability probe and the OCR
            # run agree about which models exist.
            os.environ["TESSDATA_PREFIX"] = data_path

        # Resolved lazily and remembered: probing shells out to the binary, and
        # doing that per request would add latency for no new information.
        self._available: bool | None = None
        self._version: str | None = None
        self._installed_languages: tuple[str, ...] = ()

    @property
    def name(self) -> str:
        return "tesseract"

    @property
    def version(self) -> str | None:
        """Engine version, or None when it is not installed."""
        if self._available is None:
            self.is_available()
        return self._version

    def is_available(self) -> bool:
        if self._available is not None:
            return self._available

        try:
            self._version = str(pytesseract.get_tesseract_version())
            self._installed_languages = tuple(pytesseract.get_languages(config=""))
            self._available = True
        except Exception:  # noqa: BLE001 - every failure here means "not usable"
            # pytesseract raises TesseractNotFoundError, but a broken install can
            # fail in other ways too, and all of them mean the same to a caller.
            self._version = None
            self._installed_languages = ()
            self._available = False
            logger.warning("Tesseract is not available on this machine")

        return self._available

    def describe(self) -> dict[str, Any]:
        """Health-endpoint detail. Diagnostics only - never customer-facing."""
        return {
            "engine": self.name,
            "available": self.is_available(),
            "version": self._version,
            "requestedLanguages": [lang for lang in self._languages.split("+") if lang],
            "missingLanguages": list(self.missing_languages()),
        }

    def missing_languages(self) -> tuple[str, ...]:
        """Requested language packs that are not installed.

        Worth reporting separately: `eng+urd` with only `eng` present reads Urdu
        script as garbage, and that is a configuration problem, not a bad photo.
        """
        if not self.is_available():
            return ()

        installed = set(self._installed_languages)
        return tuple(
            lang for lang in self._languages.split("+") if lang and lang not in installed
        )

    def extract_text(self, image: Image) -> OcrResult:
        if not self.is_available():
            raise OcrEngineUnavailableError("The OCR engine is not installed on this machine.")

        # Ask only for the languages Tesseract actually has, so a missing `urd`
        # degrades to English rather than failing the whole request outright.
        languages = self._usable_languages()

        try:
            data = pytesseract.image_to_data(
                image,
                lang=languages,
                config=f"--psm {self._psm}",
                output_type=pytesseract.Output.DICT,
                timeout=self._timeout,
            )
        except RuntimeError as error:
            # pytesseract signals its own timeout as a RuntimeError whose message
            # names it; anything else is a genuine engine failure.
            if "timeout" in str(error).lower():
                raise OcrEngineTimeoutError("The OCR engine took too long.") from error
            raise OcrEngineFailedError("The OCR engine failed to read the image.") from error
        except Exception as error:  # noqa: BLE001
            raise OcrEngineFailedError("The OCR engine failed to read the image.") from error

        lines, confidences = self._to_lines(data)

        return OcrResult(
            text="\n".join(line.text for line in lines),
            lines=lines,
            confidence=(sum(confidences) / len(confidences)) if confidences else None,
            engine=self.name,
            languages=tuple(lang for lang in languages.split("+") if lang),
        )

    def _usable_languages(self) -> str:
        installed = set(self._installed_languages)
        usable = [lang for lang in self._languages.split("+") if lang and lang in installed]
        return "+".join(usable) if usable else "eng"

    @staticmethod
    def _to_lines(data: dict[str, list[Any]]) -> tuple[list[OcrLine], list[float]]:
        """Groups Tesseract's per-word rows back into lines.

        image_to_data returns one row per word with block/paragraph/line numbers.
        Reassembling by that key preserves the line structure a grocery list
        depends on - one item per line - which `image_to_string` flattens away
        along with the per-word confidences.
        """
        grouped: dict[tuple[int, int, int, int], list[tuple[str, float]]] = {}
        all_confidences: list[float] = []

        for index, raw_text in enumerate(data.get("text", [])):
            text = (raw_text or "").strip()
            if not text:
                continue

            try:
                confidence = float(data["conf"][index])
            except (KeyError, IndexError, TypeError, ValueError):
                confidence = _UNRECOGNISED

            try:
                key = (
                    int(data["page_num"][index]),
                    int(data["block_num"][index]),
                    int(data["par_num"][index]),
                    int(data["line_num"][index]),
                )
            except (KeyError, IndexError, TypeError, ValueError):
                # No line structure reported: treat the word as its own line
                # rather than dropping text the engine did read.
                key = (0, 0, 0, index)

            grouped.setdefault(key, []).append((text, confidence))

            if confidence > _UNRECOGNISED:
                all_confidences.append(confidence / 100.0)

        lines: list[OcrLine] = []

        for key in sorted(grouped):
            words = grouped[key]
            scored = [confidence for _, confidence in words if confidence > _UNRECOGNISED]

            lines.append(
                OcrLine(
                    text=" ".join(word for word, _ in words),
                    # None, not 0.0, when the engine scored no word on this line
                    # well enough to report (section 11).
                    confidence=(sum(scored) / len(scored) / 100.0) if scored else None,
                )
            )

        return lines, all_confidences
