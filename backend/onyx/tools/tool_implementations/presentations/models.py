from typing import Any

from pydantic import BaseModel


class FinalPresentationResponse(BaseModel):
    view_url: str
    download_url: str | None
    filename: str
    slides_count: int
    slides_data: list[dict[str, Any]]
    artifact_id: str | None = None
