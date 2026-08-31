"""Fetches the Tesseract language packs this service needs.

Why this exists: the Tesseract installers on Windows and Debian ship English
only, and adding a language to their install directory needs administrator
rights. This downloads the models into a directory the service owns
(`AI_TESSERACT_DATA_PATH`), so bringing up a new machine is one command rather
than a manual step somebody has to remember — and so `urd` is genuinely present
rather than assumed.

The files are model weights, several megabytes each, and are deliberately not
committed: they are a build input, not source.

Usage:
    python scripts/fetch_tessdata.py                 # eng + urd, into ./tessdata
    python scripts/fetch_tessdata.py --languages eng+urd+ara --dest ./tessdata
"""

from __future__ import annotations

import argparse
import shutil
import sys
import urllib.request
from pathlib import Path

#: The official `tessdata` repository. `main` holds the standard models, which
#: are the accuracy/speed balance this service wants — `tessdata_best` is
#: markedly slower for a small gain on clean print, and worse value on the
#: phone photos of handwriting this actually reads.
BASE_URL = "https://github.com/tesseract-ocr/tessdata/raw/main/"

#: Where a system install keeps its own models, so `eng` can be copied rather
#: than downloaded when it is already on the machine.
SYSTEM_TESSDATA = [
    Path(r"C:\Program Files\Tesseract-OCR\tessdata"),
    Path("/usr/share/tesseract-ocr/5/tessdata"),
    Path("/usr/share/tesseract-ocr/4.00/tessdata"),
    Path("/usr/share/tessdata"),
]


def fetch(language: str, destination: Path) -> None:
    target = destination / f"{language}.traineddata"

    if target.exists():
        print(f"  {language}: already present")
        return

    for source_dir in SYSTEM_TESSDATA:
        candidate = source_dir / target.name
        if candidate.exists():
            shutil.copy2(candidate, target)
            print(f"  {language}: copied from {source_dir}")
            return

    url = BASE_URL + target.name
    print(f"  {language}: downloading…")

    try:
        with urllib.request.urlopen(url, timeout=120) as response, target.open("wb") as handle:
            shutil.copyfileobj(response, handle)
    except Exception as error:  # noqa: BLE001
        # Leave no half-written model behind: Tesseract would load it and fail
        # in a way that looks like a bad photo rather than a bad install.
        target.unlink(missing_ok=True)
        print(f"  {language}: FAILED ({error})", file=sys.stderr)
        raise SystemExit(1) from error

    print(f"  {language}: {target.stat().st_size // 1024} KB")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--languages", default="eng+urd", help="Plus-separated language codes")
    parser.add_argument("--dest", default="tessdata", help="Directory to write the models to")
    arguments = parser.parse_args()

    destination = Path(arguments.dest).resolve()
    destination.mkdir(parents=True, exist_ok=True)

    print(f"Fetching Tesseract models into {destination}")

    for language in filter(None, arguments.languages.split("+")):
        fetch(language, destination)

    print("Done. Set AI_TESSERACT_DATA_PATH to this directory.")


if __name__ == "__main__":
    main()
