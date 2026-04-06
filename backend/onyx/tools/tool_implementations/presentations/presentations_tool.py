import json
import logging
import re
from io import BytesIO
from typing import Any
from uuid import UUID

from typing_extensions import override

logger = logging.getLogger(__name__)

from onyx.chat.emitter import Emitter
from onyx.configs.constants import FileOrigin
from onyx.db.artifact import create_artifact
from onyx.db.artifact import create_artifact_version
from onyx.db.enums import ArtifactType
from onyx.db.engine.sql_engine import get_session_with_current_tenant
from onyx.file_store.file_store import get_default_file_store
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

    def __init__(
        self, tool_id: int, emitter: Emitter, user_id: UUID | None = None
    ) -> None:
        super().__init__(emitter=emitter)
        self._id = tool_id
        self._user_id = user_id

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

    def _save_to_artifact_store(
        self,
        title: str,
        html: str,
        slides: list[dict[str, Any]],
    ) -> str | None:
        """Save presentation HTML to FileStore and create Artifact + ArtifactVersion.
        Returns the artifact_id as string, or None on failure."""
        if self._user_id is None:
            logger.warning("No user_id available; skipping artifact creation")
            return None

        try:
            with get_session_with_current_tenant() as db_session:
                artifact = create_artifact(
                    db_session=db_session,
                    user_id=self._user_id,
                    artifact_type=ArtifactType.PRESENTATION,
                    title=title,
                )
                artifact_id = artifact.id

                safe_title = re.sub(r"[^\w\s-]", "", title).strip()
                safe_title = re.sub(r"\s+", "_", safe_title)[:50]
                file_store_key = (
                    f"artifacts/{artifact_id}/v1/{safe_title}.html"
                )

                file_store = get_default_file_store()
                html_bytes = html.encode("utf-8")
                file_store.save_file(
                    content=BytesIO(html_bytes),
                    display_name=f"{safe_title}.html",
                    file_origin=FileOrigin.OTHER,
                    file_type="text/html",
                    file_id=file_store_key,
                )

                create_artifact_version(
                    db_session=db_session,
                    artifact_id=artifact_id,
                    version_number=1,
                    file_store_key=file_store_key,
                    file_size=len(html_bytes),
                    metadata={
                        "slides_count": len(slides),
                        "theme": slides[0].get("theme") if slides else None,
                    },
                )

                db_session.commit()
                return str(artifact_id)
        except Exception:
            logger.exception("Failed to save presentation to artifact store")
            return None

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
            # Legacy filesystem save (kept for backward compat)
            filename = save_presentation(title, html)
        except Exception as e:
            raise ToolExecutionException(
                f"Failed to generate presentation: {e}",
                emit_error_packet=True,
            )

        # Save to persistent artifact store
        artifact_id = self._save_to_artifact_store(title, html, slides)

        # Build view_url: prefer artifact URL, fall back to legacy file URL
        if artifact_id:
            view_url = f"/api/artifacts/{artifact_id}/content"
        else:
            view_url = f"/api/files/presentations/{filename}"

        download_url: str | None = None

        final_response = FinalPresentationResponse(
            view_url=view_url,
            download_url=download_url,
            filename=filename,
            slides_count=len(slides),
            slides_data=slides,
            artifact_id=artifact_id,
        )

        self.emitter.emit(
            Packet(
                placement=placement,
                obj=PresentationToolFinal(
                    view_url=view_url,
                    download_url=download_url,
                    filename=filename,
                    slides_count=len(slides),
                    artifact_id=artifact_id,
                ),
            )
        )

        llm_response = json.dumps(
            {
                "view_url": view_url,
                "download_url": download_url,
                "filename": filename,
                "slides_count": len(slides),
                "slides_data": slides,
                "artifact_id": artifact_id,
            }
        )

        return ToolResponse(
            rich_response=final_response,
            llm_facing_response=llm_response,
        )
