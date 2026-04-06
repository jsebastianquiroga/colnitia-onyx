# Stage Report: Persistent Artifacts System — Phases 1 & 2

Date: 2026-04-05
Task: Design and architect a Persistent Artifacts System for Onyx

---

## Phase 1: Spec Creation

### Completed

- [x] Spec authored at `planning/tasks/artifacts-system/spec.md`
- [x] Stage-validator review: 95/100 — passed
- [x] Architect review iteration 1: 93/100 — 5 issues identified
- [x] All 5 issues resolved in spec revision

### Issues Identified (Iteration 1) and Resolutions

| # | Issue | Resolution |
|---|-------|------------|
| 1 | Missing `artifact_id` in `PresentationToolFinal` streaming packet | Added `artifact_id` field to packet schema |
| 2 | Migration orphan handling unclear | Spec updated: one-time manual script, orphans are skipped |
| 3 | Access control logic for workspace sharing not explicit | Explicit access control rules documented per sharing scope |
| 4 | FileStore delete error handling not specified | Delete strategy documented: log failures, do not rollback |
| 5 | `ArtifactType` enum — PRESENTATION vs reuse WEB_APP | Decision: add PRESENTATION as a distinct enum value |

---

## Phase 2: Architecture Review

### Completed

- [x] Revised spec submitted for architect review (iteration 2)
- [x] Architect score: 96/100 — APPROVED
- [x] 4 minor implementation notes captured for implementation stage

### Implementation Notes (Non-blocking)

| # | Note |
|---|------|
| 1 | Add pagination to `list_artifacts()` |
| 2 | Map specific `OnyxErrorCode` values for 403 and 404 responses |
| 3 | Add tenant isolation test case |
| 4 | Log exception details on FileStore delete failures |

---

## Key Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Hybrid storage: PostgreSQL (metadata) + FileStore (content) | Separates structured querying from blob storage | Queries stay fast; content scales independently |
| `ArtifactType.PRESENTATION` as new enum value | Semantic clarity; WEB_APP has different lifecycle/rendering | Avoids conflation; enables type-specific UI rendering |
| Versioning: new version by default, optional overwrite | Preserves history without forcing users to manage it | Safer default; overwrite available when needed |
| Sharing: per-user with optional public/workspace scope | Matches existing Onyx access control model | Consistent with persona/connector sharing patterns |
| Delete: DB transaction first, FileStore cleanup after | Avoids DB state referencing missing blobs | FileStore failures are logged, not surfaced to user |
| Migration: one-time manual script, skip orphans | Minimizes risk; orphans are edge cases | Clean migration path without complex error recovery |

---

## Artifacts Created

- `planning/tasks/artifacts-system/spec.md`

---

## Context for Next Stage (Implementation)

The spec is approved. The implementer should:

1. Start with the `ArtifactType` enum extension and Alembic migration for the new `artifact` table.
2. Implement FileStore integration using `BlobStorageProvider` — follow the pattern already used for user file uploads.
3. Wire `artifact_id` into the `PresentationToolFinal` streaming packet before touching the frontend.
4. Implement `list_artifacts()` with pagination from the start (do not add it as an afterthought).
5. Use `OnyxErrorCode.NOT_FOUND` and `OnyxErrorCode.FORBIDDEN` (not raw HTTP codes) for access control errors.
6. Write a tenant isolation test case alongside other integration tests.
7. Log (do not raise) FileStore delete exceptions — failure to delete content should not surface to the user.

---

## Issues Encountered

- None. Both phases completed cleanly across two iterations.
