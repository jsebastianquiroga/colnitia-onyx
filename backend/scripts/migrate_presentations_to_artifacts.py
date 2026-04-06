"""
One-time migration script: moves existing local filesystem presentations
into the persistent artifact store (FileStore + Artifact/PersistentArtifactVersion tables).

Usage:
    source .venv/bin/activate
    python -m scripts.migrate_presentations_to_artifacts

The script is idempotent: it skips files that have already been migrated
(by checking if an artifact_version with the same file_store_key exists).
"""

import json
import logging
import os
import re
from io import BytesIO
from pathlib import Path
from uuid import UUID

from sqlalchemy import text as sa_text

from onyx.configs.constants import FileOrigin
from onyx.db.artifact import create_artifact, create_artifact_version, get_artifact_by_id
from onyx.db.engine.sql_engine import get_session_with_current_tenant
from onyx.db.enums import ArtifactType
from onyx.db.models import PersistentArtifactVersion
from onyx.file_store.file_store import get_default_file_store

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)


def _get_presentations_dir() -> Path:
    base_dir = Path(os.environ.get("DATA_DIR", "/app/backend/data"))
    return base_dir / "presentations"


def _find_owner_and_message(
    db_session, filename: str
) -> tuple[UUID | None, int | None]:
    """Try to find the user who generated a presentation by searching
    tool_call_response JSON for the filename."""
    result = db_session.execute(
        sa_text(
            """
            SELECT cm.chat_session_id, cs.user_id, tc.id as tool_call_id
            FROM tool_call tc
            JOIN chat_message cm ON cm.id = tc.message_id
            JOIN chat_session cs ON cs.id = cm.chat_session_id
            WHERE tc.tool_call_response LIKE :pattern
            LIMIT 1
            """
        ),
        {"pattern": f"%{filename}%"},
    ).first()
    if result is None:
        return None, None
    return result.user_id, result.tool_call_id


def migrate() -> None:
    pres_dir = _get_presentations_dir()
    if not pres_dir.exists():
        logger.info("No presentations directory found at %s, nothing to migrate", pres_dir)
        return

    html_files = list(pres_dir.glob("*.html"))
    logger.info("Found %d HTML files in %s", len(html_files), pres_dir)

    migrated = 0
    skipped = 0
    for filepath in html_files:
        filename = filepath.name
        try:
            with get_session_with_current_tenant() as db_session:
                # Check if already migrated
                existing = (
                    db_session.query(PersistentArtifactVersion)
                    .filter(PersistentArtifactVersion.file_store_key.like(f"%{filename}%"))
                    .first()
                )
                if existing:
                    logger.info("Already migrated: %s", filename)
                    skipped += 1
                    continue

                user_id, tool_call_id = _find_owner_and_message(db_session, filename)
                if user_id is None:
                    logger.warning(
                        "Could not determine owner for %s, skipping", filename
                    )
                    skipped += 1
                    continue

                # Derive title from filename
                title = (
                    filename.replace(".html", "")
                    .rsplit("_", 2)[0]
                    .replace("_", " ")
                )

                artifact = create_artifact(
                    db_session=db_session,
                    user_id=user_id,
                    artifact_type=ArtifactType.PRESENTATION,
                    title=title,
                )

                file_store_key = f"artifacts/{artifact.id}/v1/{filename}"
                html_bytes = filepath.read_bytes()

                file_store = get_default_file_store()
                file_store.save_file(
                    content=BytesIO(html_bytes),
                    display_name=filename,
                    file_origin=FileOrigin.OTHER,
                    file_type="text/html",
                    file_id=file_store_key,
                )

                create_artifact_version(
                    db_session=db_session,
                    artifact_id=artifact.id,
                    version_number=1,
                    file_store_key=file_store_key,
                    file_size=len(html_bytes),
                )

                # Patch the tool_call_response to include artifact_id
                if tool_call_id:
                    db_session.execute(
                        sa_text(
                            """
                            UPDATE tool_call
                            SET tool_call_response = jsonb_set(
                                tool_call_response::jsonb,
                                '{artifact_id}',
                                :artifact_id_json
                            )::text
                            WHERE id = :tool_call_id
                            AND tool_call_response IS NOT NULL
                            """
                        ),
                        {
                            "artifact_id_json": json.dumps(str(artifact.id)),
                            "tool_call_id": tool_call_id,
                        },
                    )

                db_session.commit()
                migrated += 1
                logger.info("Migrated: %s -> artifact %s", filename, artifact.id)

        except Exception:
            logger.exception("Failed to migrate %s", filename)
            skipped += 1

    logger.info(
        "Migration complete: %d migrated, %d skipped out of %d total",
        migrated,
        skipped,
        len(html_files),
    )


if __name__ == "__main__":
    migrate()
