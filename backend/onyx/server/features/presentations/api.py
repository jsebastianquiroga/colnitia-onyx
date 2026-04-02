from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Dict, List, Optional
import os

from onyx.auth.users import current_user
from onyx.db.models import User
from onyx.server.features.presentations.generator import (
    generate_presentation_html,
    save_presentation,
    _get_presentations_dir,
)

router = APIRouter(prefix="/presentations")
files_router = APIRouter(prefix="/files/presentations")


class PresentationRequest(BaseModel):
    title: str
    slides: List[Dict]
    theme: str = "dark"
    author: str = "Colnitia GPT AI"


@router.post("/generate")
async def generate_presentation(
    req: PresentationRequest,
    request: Request,
    _user: User = Depends(current_user),
) -> dict:
    try:
        html = generate_presentation_html(req.title, req.slides, req.theme)
        filename = save_presentation(req.title, html)

        web_domain = os.environ.get("WEB_DOMAIN", "").rstrip("/")
        if not web_domain:
            web_domain = str(request.base_url).rstrip("/")

        view_url = f"{web_domain}/api/v1/files/presentations/{filename}"

        return {
            "success": True,
            "view_url": view_url,
            "filename": filename,
            "slides_count": len(req.slides),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@files_router.get("/{filename}")
async def get_presentation_file(filename: str):
    file_path = _get_presentations_dir() / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Presentation not found")
    return FileResponse(file_path, media_type="text/html")
