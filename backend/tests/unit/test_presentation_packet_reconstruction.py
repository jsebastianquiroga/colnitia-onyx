"""
Tests for presentation tool packet reconstruction during session reload.

Verifies that various formats of tool_call_response stored in the DB
are correctly parsed into presentation data for packet creation.

This test is self-contained to avoid heavy import chains from session_loading.
It replicates the exact parsing logic from session_loading.py's PresentationsTool
branch to verify correctness.
"""
import json
from typing import Any

import pytest


def _parse_presentation_response(
    tool_call_response: str | None,
) -> dict[str, Any] | None:
    """
    Replicates the exact parsing logic from session_loading.py's
    PresentationsTool reconstruction branch. Returns a dict with
    view_url, download_url, filename, slides_count or None if no response.
    """
    if not tool_call_response:
        return None

    try:
        response_data = json.loads(tool_call_response)
        # Handle double-encoded JSON (string inside string)
        if isinstance(response_data, str):
            response_data = json.loads(response_data)
        # Extract filename from response or derive from view_url
        filename = response_data.get("filename", "")
        if not filename and response_data.get("view_url"):
            filename = response_data["view_url"].rsplit("/", 1)[-1]
        return {
            "view_url": response_data.get("view_url", ""),
            "download_url": response_data.get("download_url"),
            "filename": filename,
            "slides_count": response_data.get("slides_count", 0),
        }
    except (json.JSONDecodeError, KeyError, TypeError, AttributeError):
        # Fallback: minimal data so presentation renderer still activates
        return {
            "view_url": "",
            "download_url": None,
            "filename": "presentation",
            "slides_count": 0,
        }


# ---------------------------------------------------------------------------
# Tests for standard format (current production)
# ---------------------------------------------------------------------------


class TestStandardFormat:
    """Tests for the current llm_facing_response format."""

    def test_full_response_with_slides_data(self) -> None:
        response = json.dumps(
            {
                "view_url": "/api/files/presentations/My_Deck_20260402_143000.html",
                "download_url": None,
                "slides_count": 5,
                "slides_data": [
                    {"title": f"Slide {i}", "content": f"Content {i}"}
                    for i in range(5)
                ],
            }
        )

        result = _parse_presentation_response(response)

        assert result is not None
        assert result["view_url"] == "/api/files/presentations/My_Deck_20260402_143000.html"
        assert result["slides_count"] == 5
        assert result["download_url"] is None
        # filename derived from view_url
        assert result["filename"] == "My_Deck_20260402_143000.html"

    def test_response_with_filename_field(self) -> None:
        """New format after fix: includes filename directly."""
        response = json.dumps(
            {
                "view_url": "/api/files/presentations/Report_20260405.html",
                "download_url": None,
                "filename": "Report_20260405.html",
                "slides_count": 3,
                "slides_data": [],
            }
        )

        result = _parse_presentation_response(response)

        assert result is not None
        assert result["filename"] == "Report_20260405.html"

    def test_response_with_download_url(self) -> None:
        response = json.dumps(
            {
                "view_url": "/api/files/presentations/deck.html",
                "download_url": "/api/files/presentations/deck.pptx",
                "slides_count": 10,
                "slides_data": [],
            }
        )

        result = _parse_presentation_response(response)

        assert result is not None
        assert result["download_url"] == "/api/files/presentations/deck.pptx"


# ---------------------------------------------------------------------------
# Tests for old/edge-case formats
# ---------------------------------------------------------------------------


class TestOldFormats:
    """Tests for responses saved before the filename fix."""

    def test_missing_filename_derives_from_view_url(self) -> None:
        """Old format: no filename. Should derive from view_url path."""
        response = json.dumps(
            {
                "view_url": "/api/files/presentations/Sales_Pitch_20260401.html",
                "download_url": None,
                "slides_count": 8,
                "slides_data": [],
            }
        )

        result = _parse_presentation_response(response)

        assert result is not None
        assert result["filename"] == "Sales_Pitch_20260401.html"

    def test_partial_data_only_view_url(self) -> None:
        """Response with only view_url (other fields missing)."""
        response = json.dumps(
            {"view_url": "/api/files/presentations/minimal.html"}
        )

        result = _parse_presentation_response(response)

        assert result is not None
        assert result["view_url"] == "/api/files/presentations/minimal.html"
        assert result["download_url"] is None
        assert result["slides_count"] == 0
        assert result["filename"] == "minimal.html"


# ---------------------------------------------------------------------------
# Tests for double-encoded JSON
# ---------------------------------------------------------------------------


class TestDoubleEncodedJSON:
    """Test that double-encoded responses are handled correctly."""

    def test_double_encoded_standard(self) -> None:
        inner = json.dumps(
            {
                "view_url": "/api/files/presentations/double.html",
                "download_url": None,
                "slides_count": 2,
                "slides_data": [],
            }
        )
        response = json.dumps(inner)  # string → "\"{ ... }\""

        result = _parse_presentation_response(response)

        assert result is not None
        assert result["view_url"] == "/api/files/presentations/double.html"
        assert result["slides_count"] == 2
        assert result["filename"] == "double.html"

    def test_double_encoded_with_filename(self) -> None:
        inner = json.dumps(
            {
                "view_url": "/api/files/presentations/x.html",
                "filename": "x.html",
                "download_url": None,
                "slides_count": 1,
                "slides_data": [],
            }
        )
        response = json.dumps(inner)

        result = _parse_presentation_response(response)

        assert result is not None
        assert result["filename"] == "x.html"


# ---------------------------------------------------------------------------
# Tests for error/fallback cases
# ---------------------------------------------------------------------------


class TestFallbackCases:
    """Test that broken data produces fallback packets instead of nothing."""

    def test_none_response(self) -> None:
        assert _parse_presentation_response(None) is None

    def test_empty_string(self) -> None:
        assert _parse_presentation_response("") is None

    def test_invalid_json(self) -> None:
        result = _parse_presentation_response("not valid json {{{")

        assert result is not None
        assert result["view_url"] == ""
        assert result["slides_count"] == 0
        assert result["filename"] == "presentation"

    def test_json_array_instead_of_object(self) -> None:
        result = _parse_presentation_response("[1, 2, 3]")

        assert result is not None
        assert result["view_url"] == ""

    def test_json_number(self) -> None:
        result = _parse_presentation_response("42")

        assert result is not None
        assert result["view_url"] == ""

    def test_json_null(self) -> None:
        result = _parse_presentation_response("null")

        assert result is not None
        assert result["view_url"] == ""

    def test_json_boolean(self) -> None:
        result = _parse_presentation_response("true")

        assert result is not None
        assert result["view_url"] == ""


# ---------------------------------------------------------------------------
# Tests for special characters
# ---------------------------------------------------------------------------


class TestSpecialCharacters:
    """Test handling of unicode, special chars, and large data."""

    def test_unicode_in_slides(self) -> None:
        response = json.dumps(
            {
                "view_url": "/api/files/presentations/unicode.html",
                "download_url": None,
                "slides_count": 1,
                "slides_data": [
                    {
                        "title": "Presentación",
                        "content": "Información técnica 日本語 🎉",
                    }
                ],
            }
        )

        result = _parse_presentation_response(response)

        assert result is not None
        assert result["slides_count"] == 1

    def test_url_encoded_filename(self) -> None:
        response = json.dumps(
            {
                "view_url": "/api/files/presentations/My%20Presentation_20260405.html",
                "download_url": None,
                "slides_count": 3,
                "slides_data": [],
            }
        )

        result = _parse_presentation_response(response)

        assert result is not None
        assert result["filename"] == "My%20Presentation_20260405.html"

    def test_large_slides_data(self) -> None:
        """50 slides with 1KB content each — should parse fine."""
        slides = [
            {"title": f"Slide {i}", "content": "x" * 1000} for i in range(50)
        ]
        response = json.dumps(
            {
                "view_url": "/api/files/presentations/large.html",
                "download_url": None,
                "slides_count": 50,
                "slides_data": slides,
            }
        )

        result = _parse_presentation_response(response)

        assert result is not None
        assert result["slides_count"] == 50

    def test_empty_view_url_no_filename(self) -> None:
        """Both view_url and filename empty — should still parse."""
        response = json.dumps(
            {
                "view_url": "",
                "download_url": None,
                "slides_count": 0,
                "slides_data": [],
            }
        )

        result = _parse_presentation_response(response)

        assert result is not None
        assert result["view_url"] == ""
        assert result["filename"] == ""
        assert result["slides_count"] == 0
