from typing import Any
from typing_extensions import override

from onyx.chat.emitter import Emitter
from onyx.configs.app_configs import WEB_DOMAIN
from onyx.server.features.presentations.generator import generate_presentation_html
from onyx.server.query_and_chat.placement import Placement
from onyx.tools.interface import Tool
from onyx.tools.models import ToolResponse


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
                            "description": "List of slide objects",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "title": {
                                        "type": "string",
                                        "description": "Slide title",
                                    },
                                    "content": {
                                        "type": "string",
                                        "description": "Markdown content for the slide body",
                                    },
                                },
                                "required": ["title", "content"],
                            },
                        },
                        "theme": {
                            "type": "string",
                            "description": "Reveal.js theme",
                            "enum": [
                                "black",
                                "white",
                                "league",
                                "beige",
                                "sky",
                                "night",
                                "serif",
                                "simple",
                                "solarized",
                                "blood",
                                "moon",
                            ],
                            "default": "night",
                        },
                    },
                    "required": ["title", "slides"],
                },
            },
        }

    @override
    def emit_start(self, placement: Placement) -> None:
        pass

    @override
    def run(
        self,
        placement: Placement,
        override_kwargs: None,
        **llm_kwargs: Any,
    ) -> ToolResponse:
        title = llm_kwargs.get("title", "Untitled Presentation")
        slides = llm_kwargs.get("slides", [])
        theme = llm_kwargs.get("theme", "night")

        # Call the generator logic ported from colnitio_gpt
        filename = generate_presentation_html(title, slides, theme)
        
        # Build the viewing URL using the WEB_DOMAIN config
        base_url = WEB_DOMAIN.rstrip("/")
        view_url = f"{base_url}/api/v1/files/presentations/{filename}"

        return ToolResponse(
            rich_response={"view_url": view_url, "filename": filename},
            llm_facing_response=f"Presentation generated successfully. User can view it at: {view_url}",
        )
