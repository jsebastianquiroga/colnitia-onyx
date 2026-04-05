import json
import logging
from typing import Any

from typing_extensions import override

logger = logging.getLogger(__name__)

from onyx.chat.emitter import Emitter
from onyx.server.features.presentations.generator import generate_presentation_html
from onyx.server.features.presentations.generator import save_presentation
from onyx.server.query_and_chat.placement import Placement
from onyx.server.query_and_chat.streaming_models import Packet
from onyx.server.query_and_chat.streaming_models import PresentationToolFinal
from onyx.server.query_and_chat.streaming_models import PresentationToolStart
from onyx.tools.interface import Tool
from onyx.tools.models import ToolCallException
from onyx.tools.models import ToolExecutionException
from onyx.tools.models import ToolResponse
from onyx.tools.tool_implementations.presentations.models import (
    FinalPresentationResponse,
)


class PresentationsTool(Tool[None]):
    NAME = "generate_presentation"
    DESCRIPTION = (
        "Generates a professional HTML presentation (slides) using Reveal.js. "
        "Returns a URL to view the presentation. Use this when the user asks for a presentation, "
        "slides, or a visual summary with multiple pages."
    )
    DISPLAY_NAME = "Presentations Generator"

    def __init__(self, tool_id: int, emitter: Emitter) -> None:
        super().__init__(emitter=emitter)
        self._id = tool_id

    @property
    @override
    def id(self) -> int:
        return self._id

    @property
    @override
    def name(self) -> str:
        return self.NAME

    @property
    @override
    def description(self) -> str:
        return self.DESCRIPTION

    @property
    @override
    def display_name(self) -> str:
        return self.DISPLAY_NAME

    @override
    def tool_definition(self) -> dict:
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": {
                    "type": "object",
                    "properties": {
                        "title": {
                            "type": "string",
                            "description": "The title of the presentation",
                        },
                        "slides": {
                            "type": "array",
                            "description": "List of slide objects. Each slide has a 'type' that determines which fields are used.",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "type": {
                                        "type": "string",
                                        "enum": [
                                            "title",
                                            "content",
                                            "stats",
                                            "quote",
                                            "section",
                                            "two_column",
                                            "closing",
                                        ],
                                        "description": "Slide layout type",
                                    },
                                    "title": {
                                        "type": "string",
                                        "description": "Slide title (used by: title, content, stats, section, two_column, closing)",
                                    },
                                    "subtitle": {
                                        "type": "string",
                                        "description": "Subtitle text (used by: title, section, closing)",
                                    },
                                    "bullets": {
                                        "type": "array",
                                        "items": {"type": "string"},
                                        "description": "Bullet points (used by: content)",
                                    },
                                    "stats": {
                                        "type": "array",
                                        "items": {
                                            "type": "object",
                                            "properties": {
                                                "value": {"type": "string"},
                                                "label": {"type": "string"},
                                            },
                                        },
                                        "description": "Stat cards (used by: stats, max 4)",
                                    },
                                    "quote": {
                                        "type": "string",
                                        "description": "Quote text (used by: quote)",
                                    },
                                    "author": {
                                        "type": "string",
                                        "description": "Quote author (used by: quote)",
                                    },
                                    "role": {
                                        "type": "string",
                                        "description": "Author role/title (used by: quote)",
                                    },
                                    "left_items": {
                                        "type": "array",
                                        "items": {"type": "string"},
                                        "description": "Left column items (used by: two_column)",
                                    },
                                    "right_items": {
                                        "type": "array",
                                        "items": {"type": "string"},
                                        "description": "Right column items (used by: two_column)",
                                    },
                                    "left_title": {
                                        "type": "string",
                                        "description": "Left column heading (used by: two_column)",
                                    },
                                    "right_title": {
                                        "type": "string",
                                        "description": "Right column heading (used by: two_column)",
                                    },
                                    "contact": {
                                        "type": "string",
                                        "description": "Contact info (used by: closing)",
                                    },
                                },
                                "required": ["type"],
                            },
                        },
                        "theme": {
                            "type": "string",
                            "description": "Visual theme for the presentation",
                            "enum": ["dark", "light", "corporate"],
                            "default": "dark",
                        },
                    },
                    "required": ["title", "slides"],
                },
            },
        }

    @override
    def emit_start(self, placement: Placement) -> None:
        self.emitter.emit(
            Packet(
                placement=placement,
                obj=PresentationToolStart(),
            )
        )

    @override
    def run(
        self,
        placement: Placement,
        override_kwargs: None,
        **llm_kwargs: Any,
    ) -> ToolResponse:
        logger.info(f"[PRES_DEBUG] PresentationsTool.run() called with kwargs: {list(llm_kwargs.keys())}")
        title = llm_kwargs.get("title")
        if not title:
            raise ToolCallException(
                message="Missing required 'title' parameter",
                llm_facing_message="The generate_presentation tool requires a 'title' parameter.",
            )

        slides = llm_kwargs.get("slides", [])
        if not slides:
            raise ToolCallException(
                message="Missing or empty 'slides' parameter",
                llm_facing_message="The generate_presentation tool requires at least one slide.",
            )

        theme = llm_kwargs.get("theme", "dark")

        try:
            html = generate_presentation_html(title, slides, theme)
            filename = save_presentation(title, html)
        except Exception as e:
            raise ToolExecutionException(
                f"Failed to generate presentation: {e}",
                emit_error_packet=True,
            )

        # Use relative URL so it works regardless of WEB_DOMAIN configuration
        view_url = f"/api/files/presentations/{filename}"

        # PPTX generation is deferred - set download_url to None
        download_url: str | None = None

        final_response = FinalPresentationResponse(
            view_url=view_url,
            download_url=download_url,
            filename=filename,
            slides_count=len(slides),
            slides_data=slides,
        )

        # Emit final packet for frontend artifact rendering
        self.emitter.emit(
            Packet(
                placement=placement,
                obj=PresentationToolFinal(
                    view_url=view_url,
                    download_url=download_url,
                    filename=filename,
                    slides_count=len(slides),
                ),
            )
        )

        # LLM-facing response includes slides_data so LLM can reference/modify in follow-up turns
        llm_response = json.dumps(
            {
                "view_url": view_url,
                "download_url": download_url,
                "filename": filename,
                "slides_count": len(slides),
                "slides_data": slides,
            }
        )

        return ToolResponse(
            rich_response=final_response,
            llm_facing_response=llm_response,
        )
