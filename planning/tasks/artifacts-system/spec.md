# Persistent Artifacts System

## Issues to Address

1. **Presentations lost on Railway redeploy** — `save_presentation()` in `backend/onyx/server/features/presentations/generator.py` writes to the local filesystem (`_get_presentations_dir()`). Railway deployments wipe ephemeral storage, making all previously generated presentations inaccessible.

2. **Session reload breaks presentation display** — On reload, `session_loading.py` reconstructs `PresentationToolFinal` packets using the `view_url` from the stored tool call response. If the file no longer exists on disk, the artifact panel gets a broken URL. There is no stable, storage-backed URL.

3. **No cross-session browsing or re-editing** — Once a user leaves a chat session, there is no way to find, share, or re-use a previously generated presentation. The LLM also has no way to reference a prior artifact during a follow-up conversation.

4. **No sharing model** — Generated content is always private and URL-guessable only if you know the filename. There is no public link or workspace-level share concept.

---

## Important Notes

- **Existing file storage infrastructure:** `backend/onyx/file_store/file_store.py` exposes a `FileStore` ABC (S3/MinIO/Postgres backends). The `FileRecord` model in `backend/onyx/db/models.py` (line 3947) already tracks `bucket_name`, `object_key`, `file_metadata` (JSONB), and timestamps. The artifact system must use this infrastructure rather than inventing a parallel storage layer.

- **`save_presentation()` is the only integration point to change in the generator:** It currently does a raw `open()` to disk. Replacing its internals (or adding a parallel save path) to write through `FileStore` is the minimal change needed in the existing presentations feature. Nothing else in `generator.py` needs to change.

- **`FinalPresentationResponse` in `models.py`** currently carries `view_url`, `download_url`, `filename`, `slides_count`, `slides_data`. The `artifact_id` field must be added here and persisted in the tool call response JSON so `session_loading.py` can reconstruct a stable URL on reload.

- **Session loading reconstruction path:** `session_loading.py` builds `PresentationToolFinal` from the stored `tool_call_response`. Once `artifact_id` is in the response JSON, the reconstructed packet can use `/api/artifacts/{id}/content` as `view_url` — no file existence check needed.

- **`FileRecord` is tenant-scoped** via `get_current_tenant_id()` and the S3 key utilities in `backend/onyx/file_store/s3_key_utils.py`. The artifact tables must follow the same tenant isolation pattern used by the rest of the codebase.

- **All DB operations must live under `backend/onyx/db/`.** The new `artifact` and `artifact_version` tables should have corresponding CRUD functions in `backend/onyx/db/artifact.py`.

- **Error handling:** All new API endpoints must raise `OnyxError` from `onyx.error_handling.exceptions`, never `HTTPException`. All FastAPI route functions must not use `response_model`; type the function return instead.

- **Alembic migration must be written manually** after running `alembic revision -m "add artifact and artifact_version tables"`.

- **Frontend routing:** The new gallery page lives at `/app/artifacts` inside the existing Next.js app router. The public access route `/app/artifacts/public/[id]` must be excluded from auth middleware (similar to how `/files/presentations/{filename}` is listed in `auth_check.py`).

- **Extensibility:** The `artifact_type` column is an enum starting with `presentation`. The schema and APIs should not hard-code presentation-specific logic — metadata goes into the JSONB `metadata` field on `artifact_version`.

---

## Implementation Strategy

### 1. Database Layer

Add two new SQLAlchemy models to `backend/onyx/db/models.py`:

- `Artifact`: `id` (UUID PK), `user_id` (FK → User), `artifact_type` (Enum: `PRESENTATION` — see note below), `title`, `description` (nullable), `current_version` (int, default 1), `is_public` (bool, default false), `shared_with_workspace` (bool, default false), `created_at`, `updated_at`.
- `ArtifactVersion`: `id` (UUID PK), `artifact_id` (FK → Artifact, cascade delete), `version_number` (int), `file_store_key` (text — the `file_id` used in `FileRecord`), `file_size` (int, nullable), `metadata` (JSONB), `source_chat_message_id` (FK → ChatMessage, nullable), `created_at`.

Add CRUD functions to `backend/onyx/db/artifact.py`:
- `create_artifact(db, user_id, artifact_type, title, ...) -> Artifact`
- `create_artifact_version(db, artifact_id, version_number, file_store_key, metadata, ...) -> ArtifactVersion`
- `get_artifact(db, artifact_id, user_id) -> Artifact | None` — enforces ownership or public/workspace access
- `list_artifacts(db, user_id, artifact_type, shared) -> list[Artifact]`
- `get_artifact_latest_version(db, artifact_id) -> ArtifactVersion`
- `get_artifact_version(db, artifact_id, version_number) -> ArtifactVersion`
- `update_artifact(db, artifact_id, user_id, **fields) -> Artifact`
- `delete_artifact(db, artifact_id, user_id) -> None` — deletes all `ArtifactVersion` rows and the `Artifact` row inside a single DB transaction first, then attempts `FileStore.delete_file()` for each version's `file_store_key`. If a `FileStore.delete_file()` call fails, log a warning and continue — do not roll back the DB transaction. The DB record is the source of truth; orphaned files in the object store are harmless and can be cleaned up out-of-band.

**`ArtifactType` enum:** The codebase already defines `ArtifactType` in `backend/onyx/db/enums.py` with values `WEB_APP`, `PPTX`, `DOCX`, `IMAGE`, `MARKDOWN`. Add `PRESENTATION` as a new value for Reveal.js HTML output — do not reuse `WEB_APP`, as the semantics are distinct and the type is used to drive rendering decisions. The Alembic migration must include an `ALTER TYPE` statement to add the new enum value before creating the `artifact` table.

Write the Alembic migration manually after generating the skeleton with `alembic revision -m "add artifact and artifact_version tables"`.

### 2. Storage Integration

Modify `save_presentation()` in `backend/onyx/server/features/presentations/generator.py` (or introduce a new `save_presentation_to_store()` function called from `PresentationsTool.run()`) to write HTML through `FileStore` using a key path: `artifacts/{artifact_id}/v{version}/{safe_title}.html`. The function returns the `file_id` (the key registered in `FileRecord`), not a filesystem path.

`PresentationsTool.run()` in `backend/onyx/tools/tool_implementations/presentations/presentations_tool.py` becomes responsible for:
1. Calling the generator to produce the HTML string.
2. Creating an `Artifact` row.
3. Saving the HTML via `FileStore` and creating an `ArtifactVersion` row.
4. Returning a `FinalPresentationResponse` that includes the `artifact_id` alongside `view_url` (`/api/artifacts/{id}/content`) and `slides_data`.

Update `FinalPresentationResponse` in `backend/onyx/tools/tool_implementations/presentations/models.py` to include `artifact_id: str`.

Also update the `PresentationToolFinal` streaming packet class in `backend/onyx/server/query_and_chat/streaming_models.py` to include `artifact_id: str | None`. This field must be present on the streaming packet so that `session_loading.py` can read it when reconstructing the packet from the stored `tool_call_response` JSON — without it, session reload cannot build a stable `view_url`.

### 3. API Layer

Create `backend/onyx/server/features/artifacts/api.py` with the following FastAPI router endpoints (all authenticated except the public access route):

| Route | Method | Handler logic |
|---|---|---|
| `/artifacts` | GET | `list_artifacts()` with optional `artifact_type` and `shared` query params. Returns the **union** of: (artifacts owned by the requesting user) OR (artifacts where `shared_with_workspace=true` AND the requesting user belongs to the same workspace). A user never sees another user's private artifacts. |
| `/artifacts/{artifact_id}` | GET | `get_artifact()` — returns metadata + versions list. Enforces the same ownership/workspace-share access rule as the list endpoint. |
| `/artifacts/{artifact_id}/content` | GET | Fetches latest version file from `FileStore`, streams back with correct Content-Type |
| `/artifacts/{artifact_id}/v/{version}/content` | GET | Same but for a specific version |
| `/artifacts/{artifact_id}` | PATCH | Updates `title`, `description`, `is_public`, `shared_with_workspace`. **Only the artifact owner may call this** — non-owners receive 403, even if the artifact is workspace-shared. |
| `/artifacts/{artifact_id}` | DELETE | Calls `delete_artifact()`. **Only the artifact owner may call this** — non-owners receive 403. |
| `/artifacts/public/{artifact_id}` | GET | Returns metadata; no auth required if `is_public=true` |
| `/artifacts/public/{artifact_id}/content` | GET | Streams file; no auth required if `is_public=true` |

Register the router in the main app. Add the public routes to the auth bypass list in `auth_check.py`.

### 4. Session Loading

In `session_loading.py`, update the branch that reconstructs `PresentationToolFinal` packets. When the stored `tool_call_response` JSON contains an `artifact_id`, build `view_url` as `/api/artifacts/{artifact_id}/content`. Fall back to the legacy `view_url` field if `artifact_id` is absent (backward compatibility for sessions created before this feature).

### 5. Frontend

**Presentation renderer update** (`web/src/app/app/message/messageComponents/renderers/PresentationToolRenderer.tsx`):
- If the packet carries `artifact_id`, compute `view_url` as `/api/artifacts/{artifact_id}/content`.
- Add a "View in My Artifacts" badge/link pointing to `/app/artifacts`.

**Gallery page** (`web/src/app/app/artifacts/page.tsx`):
- Fetches `/api/artifacts` and renders a grid of cards (title, type chip, date).
- Filters bar: type, shared toggle, date range.
- Card click opens the artifact fullscreen (for presentations: iframe embed from `/api/artifacts/{id}/content`).
- Per-card action menu: rename (PATCH title), share (PATCH `is_public` / `shared_with_workspace`), version history drawer, delete.

**Navigation:** Add an "Artifacts" link to the existing sidebar navigation (in whatever component currently renders the sidebar item list).

### 6. Migration of Existing Presentations

Write a one-time script (not a Celery task — run manually as needed) under `backend/scripts/migrate_presentations_to_artifacts.py`. It should:
1. Walk the existing presentations directory.
2. For each file: attempt to identify the owning user by matching the filename against `tool_call_response` JSON in `ChatMessage` rows. If no matching `ChatMessage` or owning user can be found, **skip the file entirely** — log a warning with the filename and continue. Do not migrate under an admin user or any placeholder identity. Orphaned files can be cleaned up manually later.
3. Attempt to locate the matching `tool_call_response` JSON in `ChatMessage` rows that reference the old filename and patch in the new `artifact_id`.

This script is best-effort. Sessions without a recoverable `artifact_id` fall back to the legacy `view_url` path.

---

## Tests

**External dependency unit test** (`backend/tests/external_dependency_unit/tools/test_presentations_artifact_integration.py`):
- Test that `PresentationsTool.run()` creates an `Artifact` and `ArtifactVersion` in the DB and writes the file to `FileStore` (real Postgres + real file store, not mocked).
- Test that the returned `FinalPresentationResponse` contains a valid `artifact_id` and a `view_url` pointing to `/api/artifacts/{id}/content`.

**Integration test** (`backend/tests/integration/tests/artifacts/test_artifact_api.py`):
- Create a presentation via the chat API, then call `GET /api/artifacts` and assert the artifact appears.
- Call `GET /api/artifacts/{id}/content` and assert a non-empty HTML response.
- PATCH the artifact title, assert the updated title is returned.
- DELETE the artifact, assert subsequent GET returns 404.
- Test public access: set `is_public=true`, call the public endpoint without auth, assert 200.
- Test that a second user cannot access a private artifact owned by the first user.

No Playwright tests are needed — the gallery UI is straightforward CRUD and the existing presentation rendering is already covered by manual QA.

---

## Acceptance Criteria

- [ ] Generated presentations survive a Railway redeploy (file stored in S3/MinIO/Postgres FileStore, not local disk)
- [ ] Loading a chat session that generated a presentation always shows the presentation artifact panel, regardless of when the session was created (as long as the artifact exists)
- [ ] `GET /api/artifacts` returns the authenticated user's artifacts and any workspace-shared artifacts
- [ ] `GET /api/artifacts/{id}/content` returns the correct HTML and is accessible without re-generating
- [ ] `GET /api/artifacts/public/{id}/content` returns the file for public artifacts without authentication
- [ ] `GET /api/artifacts/public/{id}/content` returns 403 for non-public artifacts when called without auth
- [ ] PATCH and DELETE endpoints enforce ownership — another user's request returns 403
- [ ] `artifact_type` enum is defined such that adding a new type requires only a migration and a new tool integration, not changes to the core artifact API
- [ ] Session loading falls back gracefully to the legacy `view_url` if `artifact_id` is absent in old tool call responses
- [ ] All new API routes use `OnyxError`, not `HTTPException`, and do not use `response_model`
- [ ] All new DB operations live under `backend/onyx/db/artifact.py`

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
| ---- | ------ | ---------- |
| FileStore backend not configured on Railway (filesystem fallback) | Presentations still lost on redeploy | Confirm Railway env has S3/MinIO env vars set; add a startup warning log if `FILE_STORE_BACKEND` resolves to filesystem |
| Large HTML files slow down content endpoint | Poor UX for complex presentations | Stream the file from `FileStore` using `StreamingResponse`; avoid loading into memory |
| Ownership inference fails for existing presentations during migration script | Some old presentations not linked to an artifact | Make migration script idempotent and skippable per file; old sessions fall back to legacy URL |
| `artifact_id` not propagated into LLM-facing response, so agent cannot reference it on re-call | Agent cannot edit existing artifact, creates duplicates | Include `artifact_id` in `llm_facing_response` JSON so it's available in subsequent tool calls |
| Public artifact URLs leaking sensitive content | Privacy breach | Default `is_public=false`; public routes check flag before serving; add a confirmation step in the share UI |
