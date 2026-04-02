# Colnitia-Onyx Migration — MASTER HANDOFF

> Last updated: 2026-04-02 · **STATUS: CODE COMPLETE & READY FOR CUTOVER**

---

## 📋 Overview
Successfully completed the six-sprint migration from **Colnitia GPT** (legacy) → **Colnitia-Onyx** (Modern Enterprise Stack). All feature gaps (Budgets, Tools, Connectors) have been closed.

---

## ✅ Sprint Status

| Sprint | Name                       | Status       | Highlights |
| ------ | -------------------------- | ------------ | --- |
| 1      | Infrastructure Bootstrap   | ✅ Complete  | Railway multi-service architecture |
| 2      | Rebranding                 | ✅ Complete  | Colnitia Blue branding & Logos |
| 3      | Theme System               | ✅ Complete  | Tailored CSS variables |
| 4      | Budget System              | ✅ Complete  | **NEW**: Admin UI + Token tracking |
| 5      | Advanced Tools             | ✅ Complete  | **NEW**: Presentations + Connector Config |
| 6      | Deployment & Cutover       | ✅ SUCCESS   | Healthchecks + Persistence Hardening |

---

## 🛠️ New Features & Tools

### 1. Budget Management UI
- **Location**: Login as Admin → **Budgets** (Sidebar)
- **Direct Link**: `https://[YOUR-DOMAIN]/admin/budgets`
- **Capabilities**: Monitor user spend, top up credits, and reset balances.
- **Backend**: Automated deduction after every LLM chat based on actual token costs.

### 2. HTML Presentation Tool
- **Usage**: Ask the Assistant to "Create a presentation about [topic]".
- **Output**: Generates a Reveal.js slide deck and returns a viewable public URL.
- **Tech**: Integrated as a native Onyx Tool in `built_in_tools.py`.

### 3. Smart User Migration
- **Script**: `scripts/migrate_users.py`
- **New Capability**: Now supports direct migration from your legacy **SQLite** `webui.db` file.
- **Command**:
  ```bash
  python scripts/migrate_users.py --execute --source-url "./webui.db" --target-url "$DATABASE_PUBLIC_URL"
  ```

---

## 🚩 Final Launch Checklist (ACTION REQUIRED)
Before the official "Cutover" to the new domain, perform these 4 manual steps in Railway:

1. **DB Migrations**: Run `alembic upgrade head` in the `colnitia-onyx` service terminal.
2. **Persistence**: Add a **Railway Volume** to the `opensearch` service:
   - Mount Path: `/usr/share/opensearch/data`
   - Name: `opensearch-data`
3. **SMTP (Email)**: Set `SMTP_SERVER`, `SMTP_USER`, `SMTP_PASS`, and `EMAIL_FROM` in the `colnitia-onyx` service variables.
4. **DNS Cutover**:
   - In `web_server` Settings → **Custom Domain**, add `gpt.colnitia.com`.
   - Point your CNAME to the Railway URL.

---

## 🔍 Service Map (Railway)

| Service | Public URL (Example) | Role |
|---|---|---|
| `web_server` | `https://colnitia-web.up.railway.app` | Frontend (Next.js) |
| `colnitia-onyx` | `https://colnitia-api.up.railway.app` | API Server (FastAPI) |
| `opensearch` | Internal Only | Vector Database & Search |
| `redis` | Internal Only | Task queue (Celery) & cache |
| `postgres` | Internal Only (or Railway-managed) | PostgreSQL relational database |
| `background` | Internal Only | Celery Workers (Indexing/Processing) |

---

## 🧪 Post-Launch Verification
1. Log in to [gpt.colnitia.com](https://gpt.colnitia.com).
2. Go to **Admin → Budgets** and confirm you see yourself.
3. Start a chat and verify that your "Balance" decreases slightly after the response.
4. Ask "Create a presentation about Colnitia" to verify the Tool system.

---

## 📦 Repositories
- **Onyx Fork**: [jsebastianquiroga/colnitia-onyx](https://github.com/jsebastianquiroga/colnitia-onyx)
- **Legacy GPT**: [jsebastianquiroga/colnitio_gpt](https://github.com/jsebastianquiroga/colnitio_gpt) (Keep as fallback for 7 days)

---

## 🔌 API Reference (Custom Endpoints)

These endpoints were added as part of the Colnitia migration and do **not** exist in upstream Onyx.

### Budget API

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/budget/me` | User | Get current user's budget (returns unlimited dummy if none set) |
| `PUT` | `/api/admin/budget/{user_id}` | Admin | Create or update a user's budget |
| `POST` | `/api/budget/user/{user_id}/topup` | Admin | Add credits to a user's balance |
| `POST` | `/api/budget/user/{user_id}/reset` | Admin | Reset balance and total spent to zero |
| `PATCH` | `/api/budget/user/{user_id}/update` | Admin | Toggle `is_active` flag |

**Auto-deduction**: After every LLM chat response, token costs are calculated and subtracted from the user's balance automatically via `backend/onyx/server/query_and_chat/budget_limit.py`.

### Presentations API

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/v1/presentations/generate` | User | Generate a Reveal.js HTML deck |
| `GET`  | `/api/v1/files/presentations/{filename}` | Public | View a generated presentation |

**Payload example** (`POST /api/v1/presentations/generate`):
```json
{
  "title": "Q2 Strategy",
  "slides": [
    {"type": "title", "title": "Q2 Strategy", "subtitle": "Colnitia 2026"},
    {"type": "content", "title": "Goals", "bullets": ["Revenue +30%", "New markets"]},
    {"type": "stats", "title": "KPIs", "stats": [{"value": "42%", "label": "Growth"}]},
    {"type": "quote", "quote": "Innovation matters", "author": "CEO", "role": "Founder"},
    {"type": "section", "title": "Chapter 2", "subtitle": "Next Steps"},
    {"type": "two_column", "title": "Comparison", "left_title": "Before", "right_title": "After", "left_items": ["Manual"], "right_items": ["Automated"]},
    {"type": "closing", "title": "Gracias", "subtitle": "Questions?", "contact": "team@colnitia.com"}
  ],
  "theme": "dark",
  "author": "Colnitia GPT AI"
}
```

**Supported slide types**: `title`, `content` (bullet list), `stats` (up to 4 metric cards), `quote`, `section` (divider), `two_column`, `closing`.

**Available themes**: `dark` (default), `light`, `corporate` (blue + gold accents).

---

## ⚙️ Environment Variables (Key Custom Additions)

These are **Colnitia-specific** variables added on top of the standard Onyx configuration:

| Variable | Service | Purpose |
|----------|---------|---------|
| `WEB_DOMAIN` | API Server | Public URL for generating presentation links (e.g., `https://gpt.colnitia.com`) |
| `INTERNAL_URL` | Web Server | Backend URL used by Next.js API rewrites at build time |
| `OPENSEARCH_USE_SSL` | API / Background | Set to `false` for Railway HTTP-only OpenSearch connections |
| `SMTP_SERVER` | API Server | SMTP host for transactional emails |
| `SMTP_USER` | API Server | SMTP authentication username |
| `SMTP_PASS` | API Server | SMTP authentication password |
| `EMAIL_FROM` | API Server | Sender address for outgoing emails |
| `DATABASE_PUBLIC_URL` | Migration script | Target Postgres URL for `migrate_users.py` |
| `SOURCE_DATABASE_URL` | Migration script | Source Postgres URL or SQLite path |

---

## 🗄️ Database Schema (Custom Tables)

Added via migration `a001_sprint_4_5_features.py`:

### `user_budget`
| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Budget record ID |
| `user_id` | UUID (FK → user.id) | Owning user |
| `balance` | Float | Remaining credit in USD |
| `total_spent` | Float | Cumulative spend |
| `is_active` | Boolean | Whether budget enforcement is active |
| `created_at` | Timestamp | Record creation time |
| `updated_at` | Timestamp | Last modification time |

---

## 🏗️ Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                     Railway Project                      │
│                                                          │
│  ┌──────────────┐    Next.js rewrites    ┌────────────┐ │
│  │  web_server   │ ──── /api/* ────────► │ colnitia-  │ │
│  │  (Next.js)    │                       │ onyx (API) │ │
│  │  Port 3000    │                       │ Port 8080  │ │
│  └──────────────┘                       └─────┬──────┘ │
│         │                                      │        │
│         │                              ┌───────┴──────┐ │
│         │                              │  PostgreSQL  │ │
│         │                              │  (Railway)   │ │
│         │                              └───────┬──────┘ │
│         │                                      │        │
│  ┌──────┴───────┐                      ┌───────┴──────┐ │
│  │  opensearch   │ ◄──── indexing ──── │  background  │ │
│  │  (Vector DB)  │                     │  (Celery)    │ │
│  └──────────────┘                      └──────────────┘ │
│                                                          │
│  ┌──────────────┐                                       │
│  │    Redis      │ ◄─── task queue / cache              │
│  └──────────────┘                                       │
└─────────────────────────────────────────────────────────┘
```

---

## 🔧 Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Budget page shows "Error loading budgets" | Missing DB migration | Run `alembic upgrade head` on the API service |
| Presentations return 404 | `DATA_DIR` not persisted | Add a Railway Volume at `/app/dynamic_config_storage` |
| Chat works but no budget deduction | `user_budget` row missing | Top up the user once from Admin → Budgets to create the record |
| Next.js API calls fail (502) | `INTERNAL_URL` not set at build | Redeploy `web_server` after setting `INTERNAL_URL` to the API's internal Railway URL |
| OpenSearch connection refused | SSL mismatch | Ensure `OPENSEARCH_USE_SSL=false` on Railway (no SSL on internal network) |
| User migration script fails on SQLite | `sqlite3` import or path issue | Verify the `.db` file path is correct and accessible |

---

## 📁 Key File Locations (Custom Code)

| Area | Path |
|------|------|
| Budget Admin UI | `web/src/app/admin/budgets/page.tsx` |
| Budget API lib (frontend) | `web/src/app/admin/budgets/lib.ts` |
| Budget backend API | `backend/onyx/server/features/budget/api.py` |
| Budget DB operations | `backend/onyx/db/budget.py` |
| Budget deduction logic | `backend/onyx/server/query_and_chat/budget_limit.py` |
| Presentation tool | `backend/onyx/tools/tool_implementations/presentations/presentations_tool.py` |
| Presentation generator | `backend/onyx/server/features/presentations/generator.py` |
| Presentation API | `backend/onyx/server/features/presentations/api.py` |
| DB migration (Sprint 4+5) | `backend/alembic/versions/a001_sprint_4_5_features.py` |
| User migration script | `scripts/migrate_users.py` |
| Admin route definitions | `web/src/lib/admin-routes.ts` |
| SWR cache keys | `web/src/lib/swr-keys.ts` |

---

## 🔄 Rollback Plan

If issues arise after cutover:

1. **DNS**: Re-point `gpt.colnitia.com` CNAME back to the legacy Open-WebUI host.
2. **Legacy fallback**: The `colnitio_gpt` repo remains deployed and operational for **7 days** post-cutover.
3. **Data**: User data in the new Postgres is independent — no destructive changes are made to the legacy SQLite/Postgres.
4. **Budget data**: Export if needed via `SELECT * FROM user_budget;` on the Railway Postgres before rolling back.

---

## 🔀 Upstream Sync Strategy

This repo is a **fork** of [onyx-dot-app/onyx](https://github.com/onyx-dot-app/onyx). Custom Colnitia code lives on the `colnitia/main` branch.

- **Custom commits** are prefixed with `feat:`, `fix:`, or `docs:` and reference Colnitia-specific features.
- **To sync upstream**: merge `upstream/main` into `colnitia/main` and resolve conflicts in the custom files listed above.
- **Files most likely to conflict**: `backend/onyx/main.py` (router registration), `backend/onyx/db/models.py` (ORM models), `web/src/lib/admin-routes.ts` (sidebar entries).

---

## 📝 Maintenance Notes

- **Budget deduction rates** depend on the LLM provider's token pricing. Update cost-per-token constants if switching models.
- **Presentation storage** grows over time in `DATA_DIR/presentations/`. Consider a periodic cleanup cron or retention policy.
- **Alembic migrations**: The custom migration `a001_sprint_4_5_features.py` runs after all upstream migrations. When pulling new upstream migrations, ensure no revision ID conflicts.
- **Admin sidebar**: New admin pages require an entry in `web/src/lib/admin-routes.ts` (route definition) and registration in the sidebar component.
