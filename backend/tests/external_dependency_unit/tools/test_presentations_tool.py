"""Tests for the PresentationsTool."""

import json
import os
from unittest.mock import MagicMock

import pytest

from onyx.server.query_and_chat.placement import Placement
from onyx.server.query_and_chat.streaming_models import PresentationToolFinal
from onyx.server.query_and_chat.streaming_models import PresentationToolStart
from onyx.tools.models import ToolCallException
from onyx.tools.models import ToolExecutionException
from onyx.tools.tool_implementations.presentations.models import (
    FinalPresentationResponse,
)
from onyx.tools.tool_implementations.presentations.presentations_tool import (
    PresentationsTool,
)


@pytest.fixture
def mock_emitter() -> MagicMock:
    return MagicMock()


@pytest.fixture
def presentations_tool(mock_emitter: MagicMock) -> PresentationsTool:
    return PresentationsTool(tool_id=42, emitter=mock_emitter)


@pytest.fixture
def placement() -> Placement:
    return Placement(order=0)


@pytest.fixture(autouse=True)
def tmp_data_dir(tmp_path: object, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATA_DIR", str(tmp_path))


class TestPresentationsToolProperties:
    def test_name(self, presentations_tool: PresentationsTool) -> None:
        assert presentations_tool.name == "generate_presentation"

    def test_display_name(self, presentations_tool: PresentationsTool) -> None:
        assert presentations_tool.display_name == "Presentations Generator"

    def test_id(self, presentations_tool: PresentationsTool) -> None:
        assert presentations_tool.id == 42


class TestToolDefinition:
    def test_theme_enum(self, presentations_tool: PresentationsTool) -> None:
        defn = presentations_tool.tool_definition()
        theme_prop = defn["function"]["parameters"]["properties"]["theme"]
        assert theme_prop["enum"] == ["dark", "light", "corporate"]

    def test_slide_type_enum(self, presentations_tool: PresentationsTool) -> None:
        defn = presentations_tool.tool_definition()
        slide_items = defn["function"]["parameters"]["properties"]["slides"]["items"]
        type_prop = slide_items["properties"]["type"]
        assert type_prop["enum"] == [
            "title",
            "content",
            "stats",
            "quote",
            "section",
            "two_column",
            "closing",
        ]

    def test_required_fields(self, presentations_tool: PresentationsTool) -> None:
        defn = presentations_tool.tool_definition()
        assert defn["function"]["parameters"]["required"] == ["title", "slides"]

    def test_slide_only_type_required(
        self, presentations_tool: PresentationsTool
    ) -> None:
        defn = presentations_tool.tool_definition()
        slide_items = defn["function"]["parameters"]["properties"]["slides"]["items"]
        assert slide_items["required"] == ["type"]


class TestRun:
    def test_missing_title_raises(
        self, presentations_tool: PresentationsTool, placement: Placement
    ) -> None:
        with pytest.raises(ToolCallException):
            presentations_tool.run(placement=placement, override_kwargs=None, slides=[{"type": "content"}])

    def test_empty_slides_raises(
        self, presentations_tool: PresentationsTool, placement: Placement
    ) -> None:
        with pytest.raises(ToolCallException):
            presentations_tool.run(
                placement=placement, override_kwargs=None, title="Test", slides=[]
            )

    def test_valid_input_returns_tool_response(
        self, presentations_tool: PresentationsTool, placement: Placement
    ) -> None:
        slides = [
            {"type": "title", "title": "Hello", "subtitle": "World"},
            {"type": "content", "title": "Slide 2", "bullets": ["a", "b"]},
        ]
        response = presentations_tool.run(
            placement=placement, override_kwargs=None, title="My Pres", slides=slides
        )

        assert isinstance(response.rich_response, FinalPresentationResponse)
        assert response.rich_response.slides_count == 2
        assert response.rich_response.download_url is None
        assert response.rich_response.filename.endswith(".html")
        assert "My_Pres" in response.rich_response.filename

        # Check llm_facing_response is valid JSON with expected keys
        parsed = json.loads(response.llm_facing_response)
        assert parsed["slides_count"] == 2
        assert parsed["view_url"] == response.rich_response.view_url

    def test_html_file_created_on_disk(
        self,
        presentations_tool: PresentationsTool,
        placement: Placement,
        tmp_path: object,
    ) -> None:
        slides = [{"type": "title", "title": "Test"}]
        response = presentations_tool.run(
            placement=placement, override_kwargs=None, title="DiskTest", slides=slides
        )
        filename = response.rich_response.filename  # type: ignore[union-attr]
        from pathlib import Path

        filepath = Path(str(tmp_path)) / "presentations" / filename
        assert filepath.exists()
        content = filepath.read_text()
        assert "Reveal.initialize" in content

    def test_emits_final_packet(
        self, presentations_tool: PresentationsTool, placement: Placement, mock_emitter: MagicMock
    ) -> None:
        slides = [{"type": "title", "title": "Test"}]
        presentations_tool.run(
            placement=placement, override_kwargs=None, title="EmitTest", slides=slides
        )
        # Find the PresentationToolFinal emit call
        final_calls = [
            call
            for call in mock_emitter.emit.call_args_list
            if isinstance(call.args[0].obj, PresentationToolFinal)
        ]
        assert len(final_calls) == 1
        final_obj = final_calls[0].args[0].obj
        assert final_obj.slides_count == 1
        assert final_obj.download_url is None


class TestEmitStart:
    def test_emits_start_packet(
        self,
        presentations_tool: PresentationsTool,
        placement: Placement,
        mock_emitter: MagicMock,
    ) -> None:
        presentations_tool.emit_start(placement)
        mock_emitter.emit.assert_called_once()
        packet = mock_emitter.emit.call_args.args[0]
        assert isinstance(packet.obj, PresentationToolStart)


class TestSlideTypes:
    """Test that all 7 slide types produce valid HTML."""

    @pytest.fixture
    def tool_and_placement(
        self, presentations_tool: PresentationsTool, placement: Placement
    ) -> tuple[PresentationsTool, Placement]:
        return presentations_tool, placement

    def _run_with_slide(
        self, tool: PresentationsTool, placement: Placement, slide: dict
    ) -> str:
        response = tool.run(
            placement=placement,
            override_kwargs=None,
            title="SlideTypeTest",
            slides=[slide],
        )
        return response.llm_facing_response

    def test_title_slide(
        self, tool_and_placement: tuple[PresentationsTool, Placement]
    ) -> None:
        self._run_with_slide(
            *tool_and_placement, {"type": "title", "title": "Main Title", "subtitle": "Sub"}
        )

    def test_content_slide(
        self, tool_and_placement: tuple[PresentationsTool, Placement]
    ) -> None:
        self._run_with_slide(
            *tool_and_placement, {"type": "content", "title": "Content", "bullets": ["A", "B"]}
        )

    def test_stats_slide(
        self, tool_and_placement: tuple[PresentationsTool, Placement]
    ) -> None:
        self._run_with_slide(
            *tool_and_placement,
            {"type": "stats", "title": "Stats", "stats": [{"value": "99%", "label": "Uptime"}]},
        )

    def test_quote_slide(
        self, tool_and_placement: tuple[PresentationsTool, Placement]
    ) -> None:
        self._run_with_slide(
            *tool_and_placement,
            {"type": "quote", "quote": "Hello world", "author": "Dev", "role": "Eng"},
        )

    def test_section_slide(
        self, tool_and_placement: tuple[PresentationsTool, Placement]
    ) -> None:
        self._run_with_slide(
            *tool_and_placement, {"type": "section", "title": "Part 2", "subtitle": "Next"}
        )

    def test_two_column_slide(
        self, tool_and_placement: tuple[PresentationsTool, Placement]
    ) -> None:
        self._run_with_slide(
            *tool_and_placement,
            {
                "type": "two_column",
                "title": "Compare",
                "left_title": "Left",
                "right_title": "Right",
                "left_items": ["A"],
                "right_items": ["B"],
            },
        )

    def test_closing_slide(
        self, tool_and_placement: tuple[PresentationsTool, Placement]
    ) -> None:
        self._run_with_slide(
            *tool_and_placement,
            {"type": "closing", "title": "Thanks", "subtitle": "Bye", "contact": "me@x.com"},
        )


class TestThemeVariants:
    def test_themes_produce_different_css(
        self, presentations_tool: PresentationsTool, placement: Placement, tmp_path: object
    ) -> None:
        from pathlib import Path

        contents: dict[str, str] = {}
        for theme in ["dark", "light", "corporate"]:
            response = presentations_tool.run(
                placement=placement,
                override_kwargs=None,
                title=f"Theme_{theme}",
                slides=[{"type": "title", "title": "X"}],
                theme=theme,
            )
            filename = response.rich_response.filename  # type: ignore[union-attr]
            filepath = Path(str(tmp_path)) / "presentations" / filename
            contents[theme] = filepath.read_text()

        # Each theme should have its own background color
        assert "#0f172a" in contents["dark"]  # dark background
        assert "#ffffff" in contents["light"]  # light background
        assert "#1e40af" in contents["corporate"]  # corporate background
