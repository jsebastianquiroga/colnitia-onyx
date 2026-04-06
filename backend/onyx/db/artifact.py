import logging
from uuid import UUID

from sqlalchemy import or_
from sqlalchemy.orm import Session

from onyx.db.enums import ArtifactType
from onyx.db.models import PersistentArtifact
from onyx.db.models import PersistentArtifactVersion

logger = logging.getLogger(__name__)


def create_artifact(
    db_session: Session,
    user_id: UUID,
    artifact_type: ArtifactType,
    title: str,
    description: str | None = None,
) -> PersistentArtifact:
    artifact = PersistentArtifact(
        user_id=user_id,
        artifact_type=artifact_type,
        title=title,
        description=description,
    )
    db_session.add(artifact)
    db_session.flush()
    return artifact


def create_artifact_version(
    db_session: Session,
    artifact_id: UUID,
    version_number: int,
    file_store_key: str,
    file_size: int | None = None,
    metadata: dict | None = None,
    source_chat_message_id: int | None = None,
) -> PersistentArtifactVersion:
    version = PersistentArtifactVersion(
        artifact_id=artifact_id,
        version_number=version_number,
        file_store_key=file_store_key,
        file_size=file_size,
        metadata_=metadata,
        source_chat_message_id=source_chat_message_id,
    )
    db_session.add(version)
    db_session.flush()
    return version


def get_artifact_by_id(
    db_session: Session,
    artifact_id: UUID,
) -> PersistentArtifact | None:
    return db_session.query(PersistentArtifact).filter(PersistentArtifact.id == artifact_id).first()


def list_artifacts(
    db_session: Session,
    user_id: UUID,
    artifact_type: ArtifactType | None = None,
    shared: bool | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[PersistentArtifact]:
    query = db_session.query(PersistentArtifact).filter(
        or_(
            PersistentArtifact.user_id == user_id,
            PersistentArtifact.shared_with_workspace.is_(True),
        )
    )
    if artifact_type is not None:
        query = query.filter(PersistentArtifact.artifact_type == artifact_type)
    if shared is True:
        query = query.filter(PersistentArtifact.shared_with_workspace.is_(True))
    query = query.order_by(PersistentArtifact.updated_at.desc())
    query = query.offset(offset).limit(limit)
    return list(query.all())


def get_artifact_latest_version(
    db_session: Session,
    artifact_id: UUID,
) -> PersistentArtifactVersion | None:
    return (
        db_session.query(PersistentArtifactVersion)
        .filter(PersistentArtifactVersion.artifact_id == artifact_id)
        .order_by(PersistentArtifactVersion.version_number.desc())
        .first()
    )


def get_artifact_version(
    db_session: Session,
    artifact_id: UUID,
    version_number: int,
) -> PersistentArtifactVersion | None:
    return (
        db_session.query(PersistentArtifactVersion)
        .filter(
            PersistentArtifactVersion.artifact_id == artifact_id,
            PersistentArtifactVersion.version_number == version_number,
        )
        .first()
    )


def update_artifact(
    db_session: Session,
    artifact_id: UUID,
    title: str | None = None,
    description: str | None = None,
    is_public: bool | None = None,
    shared_with_workspace: bool | None = None,
) -> PersistentArtifact | None:
    artifact = get_artifact_by_id(db_session, artifact_id)
    if artifact is None:
        return None
    if title is not None:
        artifact.title = title
    if description is not None:
        artifact.description = description
    if is_public is not None:
        artifact.is_public = is_public
    if shared_with_workspace is not None:
        artifact.shared_with_workspace = shared_with_workspace
    db_session.flush()
    return artifact


def delete_artifact(
    db_session: Session,
    artifact_id: UUID,
) -> list[str]:
    """Delete artifact and all versions from DB. Returns file_store_keys
    for caller to clean up from FileStore separately."""
    artifact = get_artifact_by_id(db_session, artifact_id)
    if artifact is None:
        return []

    file_keys = [v.file_store_key for v in artifact.versions]
    db_session.delete(artifact)
    db_session.flush()
    return file_keys


def get_artifact_content_path(
    db_session: Session,
    artifact_id: UUID,
    version_number: int | None = None,
) -> str | None:
    if version_number is not None:
        version = get_artifact_version(db_session, artifact_id, version_number)
    else:
        version = get_artifact_latest_version(db_session, artifact_id)
    if version is None:
        return None
    return version.file_store_key
