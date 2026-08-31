# FreshCarts AI Service

Reads a photo of a grocery list and returns structured grocery items.

An **internal** service. It holds no database connection, no catalogue, no
prices and no customer identity — by design. It contributes intelligence;
NestJS decides what to do with it.

```
photo ──▶ validate ──▶ preprocess ──▶ OCR ──▶ normalise ──▶ extract ──▶ JSON
```

## What it deliberately does not do

| Not here | Why | Where it lives |
| --- | --- | --- |
| Product matching | Needs the catalogue, which is business data | NestJS `ProductMatcherService` |
| Prices, stock | Business facts this service must not appear to know | NestJS + MongoDB |
| Authentication | The API authenticates the shopper before calling | NestJS |
| Rate limiting | Per shopper, and only the API knows who that is | NestJS `ScanRateLimitGuard` |

The service returns a `normalizedName` — "doodh" becomes "milk" — and the
catalogue is searched by NestJS. That split is what keeps product identity and
price out of reach of the AI tier entirely.

## Setup

```bash
python -m venv .venv
.venv/Scripts/activate            # Windows;  source .venv/bin/activate elsewhere
pip install -r requirements-dev.txt

cp .env.example .env              # then edit
python scripts/fetch_tessdata.py  # downloads eng + urd language models
```

### Tesseract

The OCR engine is a **system binary**, not a Python package.

| Platform | Install |
| --- | --- |
| Windows | `winget install UB-Mannheim.TesseractOCR` |
| Debian/Ubuntu | `apt install tesseract-ocr` |
| macOS | `brew install tesseract` |

Every one of those ships **English only**. `scripts/fetch_tessdata.py` fetches
the Urdu model into a directory this service owns, which avoids needing root to
write into the Tesseract install — set `AI_TESSERACT_DATA_PATH` to it.

Without `urd`, an Urdu-script list comes back as noise. The service does not
pretend otherwise: it reports the missing pack in `warnings` and the shopper is
told that Urdu handwriting may not read accurately.

## Running

```bash
uvicorn app.main:app --reload --port 8000
pytest
```

`GET /health` reports `degraded` rather than `ok` when the engine is missing —
a service that answers requests but cannot read anything is not healthy, and
saying `ok` would hide the one thing an operator needs to know.

## API

### `POST /api/v1/ocr/grocery-list`

`multipart/form-data` with one field, `image` (JPEG, PNG or WEBP).

```jsonc
{
  "version": "1",
  "requestId": "7cf51174-…",       // echoed from X-Request-Id, or minted here
  "language": "en",                 // en | ur | mixed | unknown
  "rawText": "2 doodh\n1 kg cheeni",// what the engine read, uninterpreted
  "items": [
    {
      "rawText": "2 doodh",         // never rewritten
      "normalizedName": "milk",     // what the catalogue is searched by
      "quantity": 2,                // how many products
      "unit": null,                 // kg | g | liter | ml | dozen | piece | pack | bottle | box
      "unitValue": null,            // the pack SIZE asked for — 500 for "500 g namak"
      "brand": null,
      "qualifiers": [],
      "confidence": 0.915,          // how well the ENGINE READ THE LINE, or null
      "recognized": true,
      "quantityAdjusted": false,
      "script": "latin"
    }
  ],
  "warnings": [],
  "diagnostics": {
    "engineConfidence": 0.92, "confidenceBand": "HIGH",
    "lineCount": 4, "skippedLineCount": 0, "processingMs": 158
  }
}
```

`quantity` and `unitValue` are different things, and confusing them is how a
list turns into an order for five hundred packets of salt:

| Written | quantity | unit | unitValue |
| --- | --- | --- | --- |
| `2 milk` | 2 | – | – |
| `500 g namak` | 1 | `g` | 500 |
| `2 dozen anday` | 2 | `dozen` | – |
| `2 x 1kg atta` | 2 | `kg` | 1 |

### Errors

Every failure has the same shape and a stable `code`:

```json
{ "version": "1", "requestId": "…", "code": "IMAGE_UNREADABLE", "message": "…" }
```

| Code | Status | Meaning |
| --- | --- | --- |
| `INVALID_IMAGE` | 400 | Not a supported image, or not an image |
| `IMAGE_TOO_LARGE` | 413 | Over `AI_MAX_IMAGE_BYTES` |
| `IMAGE_UNREADABLE` | 422 | Decoded, but nothing legible on it |
| `ENGINE_UNAVAILABLE` | 503 | Tesseract is not installed |
| `ENGINE_FAILED` | 502 | The engine ran and failed |
| `ENGINE_TIMEOUT` | 504 | The engine exceeded its budget |

An empty `items` array is a **success**, not an error: a readable page with no
groceries on it is a different thing from an unreadable photo, and the two get
different screens.

### `GET /health`

Liveness plus engine and vocabulary diagnostics. Never customer-facing.

## Layout

```
app/
  main.py                    FastAPI app, correlation id, exception handlers
  api/routes/                health.py, ocr.py
  core/                      config.py, errors.py, logging.py
  ocr/                       provider.py (the seam), tesseract_provider.py, registry.py
  services/
    image_service.py         validate, bomb-guard, preprocess
    ocr_service.py           the pipeline, top to bottom
    item_extractor.py        lines -> structured items
    quantity.py              numbers and units, in four scripts
    confidence.py            OCR confidence, and refusing to invent it
    normalization/
      text.py digits.py aliases.py
      data/                  the vocabulary — JSON, not code
scripts/fetch_tessdata.py
tests/
```

### Swapping the OCR engine

Implement `OcrProvider` (three members), register it in `app/ocr/registry.py`,
set `AI_OCR_PROVIDER`. Nothing else in the service changes, and nothing at all
in NestJS — it never learns which engine is running.

### Extending the vocabulary

`app/services/normalization/data/*.json`. Adding a Roman-Urdu spelling is a
one-line data change with no parser logic attached, which is the point: this
vocabulary grows from support tickets and shopkeepers, not from code review.

## Privacy

Grocery-list images are **never written to disk** — not by the API, not here.
The upload lives in memory for one request and is then garbage. Logs carry
sizes, counts, durations and outcomes; never the image, never the extracted
text, never anything identifying a person.
