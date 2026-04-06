---
name: Persistent Artifacts System Spec
description: Spec for replacing filesystem presentation storage with a DB+FileStore artifact system; two new tables, artifact gallery page, session reload fix
type: project
---

Spec written at `planning/tasks/artifacts-system/spec.md`.

**Why:** Filesystem storage on Railway is ephemeral; presentations are lost on redeploy. Also enables cross-session browsing and sharing.

**How to apply:** When working on any presentation tool or file storage changes, check whether the artifact tables (`artifact`, `artifact_version`) exist yet. The spec is the source of truth for the intended DB schema, API contract, and migration strategy.

Key decisions recorded in spec:
- Use existing `FileStore` ABC (not a new storage layer)
- `save_presentation()` integration point — replace filesystem write with FileStore write
- Session loading falls back to legacy `view_url` if `artifact_id` absent
- `artifact_type` is an enum (extensible); type-specific data goes in JSONB `metadata`
- Public routes must be added to auth bypass list in `auth_check.py`
- Migration of existing presentations is a one-off manual script, not a Celery task
