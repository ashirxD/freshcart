"""The HTTP surface: contract, failures and the health endpoint.

Sections 9, 11, 39, 57, 58, 59 and 70.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.core.errors import (
    OcrEngineFailedError,
    OcrEngineTimeoutError,
    OcrEngineUnavailableError,
)
from app.schemas.ocr import CONTRACT_VERSION, GroceryListResponse
from tests.conftest import FakeOcrProvider, make_image, upload


class TestSuccessfulScan:
    def test_returns_the_documented_contract(
        self, client: TestClient, provider: FakeOcrProvider
    ) -> None:
        provider.text = "2 doodh\n1 kg cheeni\n1 dozen anday"

        response = upload(client, make_image())

        assert response.status_code == 200
        body = response.json()

        assert body["version"] == CONTRACT_VERSION
        assert body["requestId"]
        assert body["language"] == "en"
        # Section 10: the raw text is returned alongside, not instead of, the
        # structured items.
        assert body["rawText"] == provider.text

        assert [item["normalizedName"] for item in body["items"]] == ["milk", "sugar", "eggs"]
        assert body["items"][0]["quantity"] == 2
        assert body["items"][1]["unit"] == "kg"

    def test_the_response_validates_against_its_own_schema(
        self, client: TestClient, provider: FakeOcrProvider
    ) -> None:
        # The contract is a Pydantic model, not a dict that happens to look
        # right - which is what lets NestJS validate it (section 39).
        provider.text = "2 doodh"
        GroceryListResponse.model_validate(upload(client, make_image()).json())

    def test_no_product_id_or_price_is_ever_returned(
        self, client: TestClient, provider: FakeOcrProvider
    ) -> None:
        # Section 0: this service has never seen the catalogue and must not
        # appear to have an opinion about it.
        provider.text = "2 doodh"
        item = upload(client, make_image()).json()["items"][0]

        assert "productId" not in item
        assert "price" not in item
        assert "product" not in item

    def test_urdu_lists_are_read_and_reported_as_urdu(
        self, client: TestClient, provider: FakeOcrProvider
    ) -> None:
        provider.text = "۲ دودھ\n۱ کلو چینی"

        body = upload(client, make_image()).json()

        assert body["language"] == "ur"
        assert [item["normalizedName"] for item in body["items"]] == ["milk", "sugar"]
        assert body["items"][0]["script"] == "urdu"

    def test_a_mixed_list_is_reported_as_mixed(
        self, client: TestClient, provider: FakeOcrProvider
    ) -> None:
        provider.text = "2 doodh\n۱ کلو چینی"
        assert upload(client, make_image()).json()["language"] == "mixed"

    def test_the_correlation_id_is_echoed_back(
        self, client: TestClient, provider: FakeOcrProvider
    ) -> None:
        # Section 72: one id across frontend, NestJS and here.
        provider.text = "2 doodh"

        response = client.post(
            "/api/v1/ocr/grocery-list",
            files={"image": ("list.png", make_image(), "image/png")},
            headers={"X-Request-Id": "corr-123"},
        )

        assert response.headers["X-Request-Id"] == "corr-123"
        assert response.json()["requestId"] == "corr-123"


class TestConfidence:
    def test_the_engine_confidence_is_reported_as_given(
        self, client: TestClient, provider: FakeOcrProvider
    ) -> None:
        provider.text = "2 doodh"
        provider.confidence = 0.93

        diagnostics = upload(client, make_image()).json()["diagnostics"]

        assert diagnostics["engineConfidence"] == pytest.approx(0.93)
        assert diagnostics["confidenceBand"] == "HIGH"

    def test_an_unreported_confidence_stays_null(
        self, client: TestClient, provider: FakeOcrProvider
    ) -> None:
        # Section 11: no number is invented when the engine does not give one.
        provider.text = "2 doodh"
        provider.confidence = None
        provider.line_confidences = [None]

        body = upload(client, make_image()).json()

        assert body["diagnostics"]["engineConfidence"] is None
        assert body["diagnostics"]["confidenceBand"] == "UNKNOWN"
        assert body["items"][0]["confidence"] is None


class TestEmptyAndUnreadable:
    def test_a_readable_page_with_no_groceries_returns_an_empty_list(
        self, client: TestClient, provider: FakeOcrProvider
    ) -> None:
        # Section 58: this is a success with nothing on it, not an error. The UI
        # shows "we could not find any grocery items", which is a different
        # screen from "that photo was unreadable".
        provider.text = (
            "Minutes of the quarterly planning session held today\n"
            "Please remember to call Ahmed about that invoice"
        )
        provider.confidence = 0.95

        response = upload(client, make_image())

        assert response.status_code == 200
        assert response.json()["items"] == []

    def test_an_unreadable_page_is_reported_as_such(
        self, client: TestClient, provider: FakeOcrProvider
    ) -> None:
        # Section 59: both signals have to agree - low confidence AND nothing
        # extracted - before blaming the photo.
        provider.text = "~~ ///"
        provider.confidence = 0.12

        response = upload(client, make_image())

        assert response.status_code == 422
        assert response.json()["code"] == "IMAGE_UNREADABLE"

    def test_low_confidence_alone_does_not_condemn_a_readable_list(
        self, client: TestClient, provider: FakeOcrProvider
    ) -> None:
        # A short list of clear words can score modestly. If items came out, the
        # shopper gets them and decides.
        provider.text = "2 doodh"
        provider.confidence = 0.20

        response = upload(client, make_image())

        assert response.status_code == 200
        assert len(response.json()["items"]) == 1

    def test_a_blank_photo_is_rejected_before_ocr_runs(
        self, client: TestClient, provider: FakeOcrProvider
    ) -> None:
        response = upload(client, make_image(blank=True))

        assert response.status_code == 422
        assert response.json()["code"] == "IMAGE_UNREADABLE"
        # The expensive step is skipped entirely - the shopper gets the advice
        # several seconds sooner.
        assert provider.calls == 0

    def test_a_tiny_image_is_rejected_before_ocr_runs(
        self, client: TestClient, provider: FakeOcrProvider
    ) -> None:
        response = upload(client, make_image(width=40, height=30))

        assert response.status_code == 422
        assert response.json()["code"] == "IMAGE_UNREADABLE"
        assert provider.calls == 0


class TestInvalidUploads:
    def test_a_non_image_file_is_refused(self, client: TestClient) -> None:
        # Refused on what the bytes ARE, not on the name or the content type -
        # both of which the caller controls.
        response = upload(client, b"#!/bin/sh\nrm -rf /", filename="list.png")

        assert response.status_code == 400
        assert response.json()["code"] == "INVALID_IMAGE"

    def test_an_unsupported_image_format_is_refused(self, client: TestClient) -> None:
        # A real, valid image - in a format that is not on the allowlist.
        response = upload(client, make_image(fmt="BMP"), filename="list.bmp")

        assert response.status_code == 400
        assert response.json()["code"] == "INVALID_IMAGE"

    def test_an_oversized_upload_is_refused(
        self, client: TestClient, provider: FakeOcrProvider
    ) -> None:
        client.app.state.ocr_service._settings.max_image_bytes = 1024  # noqa: SLF001

        response = upload(client, make_image(width=1200, height=1600))

        assert response.status_code == 413
        assert response.json()["code"] == "IMAGE_TOO_LARGE"
        assert provider.calls == 0

    def test_a_request_with_no_file_is_refused(self, client: TestClient) -> None:
        response = client.post("/api/v1/ocr/grocery-list")

        assert response.status_code == 422
        assert response.json()["code"] == "INVALID_IMAGE"


class TestEngineFailures:
    @pytest.mark.parametrize(
        ("error", "status", "code"),
        [
            (OcrEngineUnavailableError("no engine"), 503, "ENGINE_UNAVAILABLE"),
            (OcrEngineFailedError("boom"), 502, "ENGINE_FAILED"),
            (OcrEngineTimeoutError("slow"), 504, "ENGINE_TIMEOUT"),
        ],
    )
    def test_each_failure_has_its_own_status_and_code(
        self,
        client: TestClient,
        provider: FakeOcrProvider,
        error: Exception,
        status: int,
        code: str,
    ) -> None:
        provider.error = error

        response = upload(client, make_image())

        assert response.status_code == status
        assert response.json()["code"] == code

    def test_an_unexpected_error_never_leaks_internals(
        self, client: TestClient, provider: FakeOcrProvider
    ) -> None:
        provider.error = ZeroDivisionError("division by zero in the tokeniser")

        response = client.post(
            "/api/v1/ocr/grocery-list",
            files={"image": ("list.png", make_image(), "image/png")},
        )

        assert response.status_code == 500
        body = response.json()
        assert body["code"] == "ENGINE_FAILED"
        # Section 36: no stack trace, no exception class, no internal detail.
        assert "ZeroDivision" not in body["message"]
        assert "tokeniser" not in body["message"]


class TestDegradedEngine:
    def test_a_missing_language_pack_is_warned_about_not_hidden(
        self, client: TestClient, provider: FakeOcrProvider
    ) -> None:
        provider.text = "2 doodh"
        provider.missing = ("urd",)

        warnings = upload(client, make_image()).json()["warnings"]

        assert any("Urdu" in warning for warning in warnings)


class TestHealth:
    def test_reports_ok_when_the_engine_is_installed(self, client: TestClient) -> None:
        body = client.get("/health").json()

        assert body["status"] == "ok"
        assert body["ocr"]["available"] is True
        assert body["vocabulary"]["groceryTerms"] > 0

    def test_reports_degraded_when_the_engine_is_missing(
        self, client: TestClient, provider: FakeOcrProvider
    ) -> None:
        # A service that answers but cannot read anything is not healthy, and
        # saying "ok" would hide the one thing an operator needs to know.
        provider.available = False

        body = client.get("/health").json()

        assert body["status"] == "degraded"
        assert body["ocr"]["available"] is False
