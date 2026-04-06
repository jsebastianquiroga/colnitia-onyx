import logging
from uuid import UUID

from fastapi import APIRouter
from fastapi import Depends
from fastapi import Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from onyx.auth.users import current_user
from onyx.db.artifact import delete_artifact
from onyx.db.artifact import get_artifact_by_id
from onyx.db.artifact import get_artifact_content_path
from onyx.db.artifact import list_artifacts
from onyx.db.artifact import update_artifact
from onyx.db.engine.sql_engine import get_session
from onyx.db.enums import ArtifactType
from onyx.db.models import PersistentArtifact
from onyx.db.models import User
from onyx.error_handling.error_codes import OnyxErrorCode
from onyx.error_handling.exceptions import OnyxError
from onyx.file_store.file_store import get_default_file_store

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/artifacts")
public_router = APIRouter(prefix="/artifacts/public")


class ArtifactVersionResponse(BaseModel):
    id: str
    version_number: int
    file_size: int | None
    created_at: str


class ArtifactResponse(BaseModel):
    id: str
    user_id: str
    artifact_type: str
    title: str
    description: str | None
    current_version: int
    is_public: bool
    shared_with_workspace: bool
    created_at: str
    updated_at: str
    versions: list[ArtifactVersionResponse] | None = None


class ArtifactUpdateRequest(BaseModel):
    title: str | None = None
    description: str | None = None
    is_public: bool | None = None
    shared_with_workspace: bool | None = None


def _artifact_to_response(
    artifact: PersistentArtifact, include_versions: bool = False
) -> ArtifactResponse:
    versions = None
    if include_versions:
        versions = [
            ArtifactVersionResponse(
                id=str(v.id),
                version_number=v.version_number,
                file_size=v.file_size,
                created_at=v.created_at.isoformat(),
            )
            for v in artifact.versions
        ]
    return ArtifactResponse(
        id=str(artifact.id),
        user_id=str(artifact.user_id),
        artifact_type=artifact.artifact_type,
        title=artifact.title,
        description=artifact.description,
        current_version=artifact.current_version,
        is_public=artifact.is_public,
        shared_with_workspace=artifact.shared_with_workspace,
        created_at=artifact.created_at.isoformat(),
        updated_at=artifact.updated_at.isoformat(),
        versions=versions,
    )


@router.get("")
def list_user_artifacts(
    artifact_type: str | None = Query(None),
    shared: bool | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: User = Depends(current_user),
    db_session: Session = Depends(get_session),
) -> list[ArtifactResponse]:
    a_type = None
    if artifact_type is not None:
        try:
            a_type = ArtifactType(artifact_type)
        except ValueError:
            raise OnyxError(
                OnyxErrorCode.INVALID_INPUT,
                f"Invalid artifact_type: {artifact_type}",
            )
    artifacts = list_artifacts(
        db_session=db_session,
        user_id=user.id,
        artifact_type=a_type,
        shared=shared,
        limit=limit,
        offset=offset,
    )
    return [_artifact_to_response(a) for a in artifacts]


@router.get("/{artifact_id}")
def get_artifact(
    artifact_id: UUID,
    user: User = Depends(current_user),
    db_session: Session = Depends(get_session),
) -> ArtifactResponse:
    artifact = get_artifact_by_id(db_session, artifact_id)
    if artifact is None:
        raise OnyxError(OnyxErrorCode.NOT_FOUND, "Artifact not found")
    # Access check: owner or workspace-shared
    if artifact.user_id != user.id and not artifact.shared_with_workspace:
        raise OnyxError(OnyxErrorCode.NOT_FOUND, "Artifact not found")
    return _artifact_to_response(artifact, include_versions=True)


def _stream_artifact_content(
    db_session: Session, artifact_id: UUID, version_number: int | None = None
) -> StreamingResponse:
    file_key = get_artifact_content_path(db_session, artifact_id, version_number)
    if file_key is None:
        raise OnyxError(OnyxErrorCode.NOT_FOUND, "Artifact content not found")
    file_store = get_default_file_store()
    try:
        file_io = file_store.read_file(file_key)
    except Exception:
        logger.exception(f"Failed to read artifact file: {file_key}")
        raise OnyxError(OnyxErrorCode.NOT_FOUND, "Artifact content not found")
    return StreamingResponse(file_io, media_type="text/html")


@router.get("/{artifact_id}/content")
def get_artifact_content(
    artifact_id: UUID,
    user: User = Depends(current_user),
    db_session: Session = Depends(get_session),
) -> StreamingResponse:
    artifact = get_artifact_by_id(db_session, artifact_id)
    if artifact is None:
        raise OnyxError(OnyxErrorCode.NOT_FOUND, "Artifact not found")
    if artifact.user_id != user.id and not artifact.shared_with_workspace:
        raise OnyxError(OnyxErrorCode.NOT_FOUND, "Artifact not found")
    return _stream_artifact_content(db_session, artifact_id)


@router.get("/{artifact_id}/v/{version}/content")
def get_artifact_version_content(
    artifact_id: UUID,
    version: int,
    user: User = Depends(current_user),
    db_session: Session = Depends(get_session),
) -> StreamingResponse:
    artifact = get_artifact_by_id(db_session, artifact_id)
    if artifact is None:
        raise OnyxError(OnyxErrorCode.NOT_FOUND, "Artifact not found")
    if artifact.user_id != user.id and not artifact.shared_with_workspace:
        raise OnyxError(OnyxErrorCode.NOT_FOUND, "Artifact not found")
    return _stream_artifact_content(db_session, artifact_id, version)


@router.patch("/{artifact_id}")
def patch_artifact(
    artifact_id: UUID,
    update_req: ArtifactUpdateRequest,
    user: User = Depends(current_user),
    db_session: Session = Depends(get_session),
) -> ArtifactResponse:
    artifact = get_artifact_by_id(db_session, artifact_id)
    if artifact is None:
        raise OnyxError(OnyxErrorCode.NOT_FOUND, "Artifact not found")
    if artifact.user_id != user.id:
        raise OnyxError(
            OnyxErrorCode.INSUFFICIENT_PERMISSIONS,
            "Only the artifact owner can update this artifact",
        )
    updated = update_artifact(
        db_session=db_session,
        artifact_id=artifact_id,
        title=update_req.title,
        description=update_req.description,
        is_public=update_req.is_public,
        shared_with_workspace=update_req.shared_with_workspace,
    )
    if updated is None:
        raise OnyxError(OnyxErrorCode.NOT_FOUND, "Artifact not found")
    db_session.commit()
    return _artifact_to_response(updated, include_versions=True)


@router.delete("/{artifact_id}")
def delete_artifact_endpoint(
    artifact_id: UUID,
    user: User = Depends(current_user),
    db_session: Session = Depends(get_session),
) -> dict[str, bool]:
    artifact = get_artifact_by_id(db_session, artifact_id)
    if artifact is None:
        raise OnyxError(OnyxErrorCode.NOT_FOUND, "Artifact not found")
    if artifact.user_id != user.id:
        raise OnyxError(
            OnyxErrorCode.INSUFFICIENT_PERMISSIONS,
            "Only the artifact owner can delete this artifact",
        )
    file_keys = delete_artifact(db_session, artifact_id)
    db_session.commit()

    # Best-effort FileStore cleanup
    file_store = get_default_file_store()
    for key in file_keys:
        try:
            file_store.delete_file(key)
        except Exception as e:
            logger.warning(
                f"Failed to delete file from store: key={key}, "
                f"error_type={type(e).__name__}, error_msg={e}"
            )

    return {"success": True}


# --- Public routes (no auth) ---


@public_router.get("/{artifact_id}")
def get_public_artifact(
    artifact_id: UUID,
    db_session: Session = Depends(get_session),
) -> ArtifactResponse:
    artifact = get_artifact_by_id(db_session, artifact_id)
    if artifact is None or not artifact.is_public:
        raise OnyxError(OnyxErrorCode.NOT_FOUND, "Artifact not found")
    return _artifact_to_response(artifact)


@public_router.get("/{artifact_id}/content")
def get_public_artifact_content(
    artifact_id: UUID,
    db_session: Session = Depends(get_session),
) -> StreamingResponse:
    artifact = get_artifact_by_id(db_session, artifact_id)
    if artifact is None or not artifact.is_public:
        raise OnyxError(OnyxErrorCode.NOT_FOUND, "Artifact not found")
    return _stream_artifact_content(db_session, artifact_id)
