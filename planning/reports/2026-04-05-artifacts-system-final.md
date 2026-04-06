# Stage Report: Persistent Artifacts System — Final

Date: 2026-04-05
Task: Implement a generic, versioned artifact storage system starting with presentations

## Completed

- [x] Spec (2 iterations, score 95 → 96 / 100)
- [x] Architecture review approved
- [x] Implementation (2 iterations)
- [x] QA passed (caught and fixed 2 critical issues before merge)

## Artifacts Created

### Backend
- `backend/onyx/db/artifact.py` — CRUD functions with pagination
- `backend/onyx/server/features/artifacts/__init__.py`
- `backend/onyx/server/features/artifacts/api.py` — 7 REST endpoints
- `backend/alembic/versions/a003_add_artifact_tables.py` — DB migration
- `backend/scripts/migrate_presentations_to_artifacts.py` — One-time migration script

### Frontend
- `web/src/app/app/artifacts/page.tsx` — Artifact gallery page

## Files Modified

### Backend
- `backend/onyx/db/enums.py` — Added PRESENTATION to artifact type enum
- `backend/onyx/db/models.py` — PersistentArtifact + PersistentArtifactVersion models
- `backend/onyx/tools/tool_implementations/presentations/models.py` — Added artifact_id field
- `backend/onyx/tools/tool_implementations/presentations/presentations_tool.py` — FileStore integration
- `backend/onyx/tools/tool_constructor.py` — user_id passthrough to tool
- `backend/onyx/server/query_and_chat/streaming_models.py` — artifact_id in streaming packet
- `backend/onyx/server/query_and_chat/session_loading.py` — artifact URL reconstruction on reload
- `backend/onyx/server/auth_check.py` — Public route bypass for artifact URLs
- `backend/onyx/main.py` — Router registration

### Frontend
- `web/src/app/app/services/streamingModels.ts` — artifact_id field
- `web/src/app/app/message/messageComponents/renderers/PresentationToolRenderer.tsx` — Stable URLs + gallery link
- `web/src/sections/sidebar/AppSidebar.tsx` — Nav link to artifacts gallery

## Decisions Made

| Decision | Rationale | Impact |
| -------- | --------- | ------ |
| Renamed Artifact → PersistentArtifact | Collision with existing BuildSession Artifact class | All model references use PersistentArtifact |
| String(50) for artifact_type instead of PG enum | Simpler migrations; no alembic enum ops needed | Easy to add new artifact types without migrations |
| DB-first delete with best-effort FileStore cleanup | Ensures DB consistency; logs FileStore failures | File orphans possible but DB stays clean |
| Pagination via limit/offset on list endpoint | Simple, sufficient for gallery use case | No cursor-based pagination needed at this scale |
| artifact_id surfaced in streaming packet | Enables frontend to link to stable artifact URL immediately | PresentationToolRenderer can show link without extra fetch |

## QA Issues Found and Fixed

1. **Class name collision** — Initial implementation named the model `Artifact`, colliding with the existing `Artifact` class used in BuildSession. Renamed to `PersistentArtifact` throughout.
2. **Migration schema mismatch** — Migration originally used a native PostgreSQL enum for artifact_type. QA caught this would complicate future type additions. Changed to `String(50)`.

## Learnings

- Always grep for the intended class name before creating a new model — Onyx has many internal domain classes that share common names (Artifact, Document, Session).
- Native PG enums in Alembic require explicit `op.execute()` statements to add values; String columns are far less friction for extensible type fields.
- FileStore and DB operations should never be in the same transaction — treat FileStore as a side effect with logging, not a rollback target.

## Context for Next Session

- The Persistent Artifacts System is complete and merged. Presentations are the first artifact type.
- The gallery page at `/app/artifacts` lists all user artifacts with pagination.
- To add a new artifact type: add a value to `ArtifactType` in `enums.py`, create a tool that saves via the artifact CRUD functions in `artifact.py`, and add a renderer in the frontend.
- The one-time migration script at `backend/scripts/migrate_presentations_to_artifacts.py` should be run against production once before deploying, to backfill existing presentation data.
