# Colnitia-Onyx Migration — HANDOFF Document

> Last updated: 2026-04-01 · Phase 4 (QA Verification) complete locally. Next: manual Railway deploy.

---

## Overview

Six-sprint migration from **Colnitia GPT** (Open-WebUI fork, `colnitio_gpt`) → **Colnitia-Onyx** (Onyx fork, `colnitia-onyx`).

---

## Sprint Status

| Sprint | Name                       | Status       |
| ------ | -------------------------- | ------------ |
| 1      | Infrastructure Bootstrap   | ✅ Complete  |
| 2      | Rebranding                 | ✅ Complete  |
| 3      | Theme System               | ✅ Complete  |
| 4      | Budget System              | ⏭️ Skipped  |
| 5      | Advanced Connectors        | ⏭️ Skipped  |
| 6      | Deployment & Cutover       | 🔄 Active   |

> Sprints 4 and 5 intentionally skipped to fast-track production. May be revisited post-launch.

---

## Sprint 6 — Deployment & Cutover

### Phase Progress

| Phase   | Name                | Status                          |
| ------- | ------------------- | ------------------------------- |
| Phase 1 | Spec Creation       | ✅ Complete                     |
| Phase 2 | Architecture Review | ✅ Complete                     |
| Phase 3 | Implementation      | ✅ Complete                     |
| Phase 4 | QA Verification     | ✅ Local QA Done → 🔄 Cloud Deploy Pending |

---

## Architecture (Railway)

| Service       | Source                                 | Technology            |
| ------------- | -------------------------------------- | --------------------- |
| `api_server`  | `backend/Dockerfile`                   | Python / FastAPI      |
| `web_server`  | `web/Dockerfile`                       | Next.js (Node 20)     |
| `background`  | `backend/Dockerfile`                   | Supervisord + Celery  |
| `model_server`| `backend/Dockerfile.model_server`      | FastAPI / SentenceTransformers (port 9000) |
| `opensearch`  | `opensearchproject/opensearch:3.4.0`   | 1 GB heap             |
| `postgresql`  | Railway Plugin                         | Managed               |
| `redis`       | Railway Plugin                         | Managed               |

Deployment config: [`deployment/railway/docker-compose.railway.yml`](../../deployment/railway/docker-compose.railway.yml)

---

## Key Decisions

1. **Vector DB**: OpenSearch at 1 GB heap (Vespa requires ≥4 GB — not viable on Railway).
2. **File Storage**: `local` for Phase 1. Switch to S3 once a bucket is provisioned.
3. **Auth**: `basic` — simplest path to prod. SAML/OAuth post-launch.
4. **DB Migrations**: `alembic upgrade head` runs inside `api_server` startup.
5. **Model Server**: Included — required for document indexing and RAG.

---

## Phase 4 QA — Issues Found & Fixed

| # | Issue | Fix |
|---|-------|-----|
| 🔴 | `model_server` missing from compose | Added service using `Dockerfile.model_server` |
| 🔴 | Named volumes unsupported on Railway | Documented Railway Volume plugin workaround in README |
| 🟠 | No `railway.json` files | Created `railway.{api,web,background,model_server}.json` |
| 🟠 | `SECRET_KEY` / `ENCRYPTION_KEY_SECRET` absent | Added to all backend services |
| 🟠 | `web_server` missing `PORT` | Added `PORT=3000` |
| 🟡 | `MODEL_SERVER_HOST` not set | Added to `api_server` + `background` |
| 🟡 | `FILE_STORE_BACKEND` / `WEB_DOMAIN` absent | Added (`local` for Phase 1) |

**YAML validation**: `docker compose config --quiet` → ✅ PASSED

---

## Files Created This Session

| File | Purpose |
|------|---------|
| `deployment/railway/docker-compose.railway.yml` | Updated — all fixes applied |
| `deployment/railway/railway.api.json` | Railway service config — API server |
| `deployment/railway/railway.web.json` | Railway service config — Web server |
| `deployment/railway/railway.background.json` | Railway service config — Background worker |
| `deployment/railway/railway.model_server.json` | Railway service config — Model server |
| `deployment/railway/README.md` | Step-by-step Railway setup guide |

---

## Next Steps (Cloud Deploy)

Follow `deployment/railway/README.md`. Critical pre-deploy actions:

```bash
openssl rand -hex 32  # → SECRET_KEY
openssl rand -hex 32  # → ENCRYPTION_KEY_SECRET
```

**Validation checklist** (after all 5 services show Running):
- [ ] Login page loads with Colnitia branding
- [ ] Create account → log in
- [ ] Upload a PDF
- [ ] Ask RAG question → answer cites the document
- [ ] Railway Metrics → no service > 90% memory

---

## Contacts & Resources

- Railway project: TBD (create after credentials are ready)
- Onyx upstream: <https://github.com/onyx-dot-app/onyx>
- Previous migration plan artifact: `56ead686-294e-4596-b3af-df4c04b84e26/implementation_plan.md`
