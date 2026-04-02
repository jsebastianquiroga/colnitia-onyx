# Railway Deployment — Colnitia Onyx

This directory contains the Railway-specific deployment configuration for the **Colnitia Onyx** stack.

## Services

| Service | Dockerfile | Port | railway.json |
|---|---|---|---|
| `api_server` | `backend/Dockerfile` | 8080 | `railway.api.json` |
| `web_server` | `web/Dockerfile` | 3000 | `railway.web.json` |
| `background` | `backend/Dockerfile` | — | `railway.background.json` |
| `model_server` | `backend/Dockerfile.model_server` | 9000 | `railway.model_server.json` |
| `opensearch` | `opensearchproject/opensearch:3.4.0` | 9200 | (no JSON — preconfigured image) |

## First-Time Setup on Railway

### 1. Create a Railway Project

1. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo** → select `colnitia-onyx`.
2. Railway will auto-detect the root. You'll add services manually below.

### 2. Add Managed Plugins

In the Railway project dashboard, add:
- **PostgreSQL** plugin → Railway injects `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD` automatically.
- **Redis** plugin → Railway injects `REDISHOST`, `REDISPORT`, `REDISPASSWORD` automatically.

### 3. Add Services from Docker Compose

For each service in `docker-compose.railway.yml`, create a Railway service:

```
New Service → Docker Image or Dockerfile
  - api_server    → Dockerfile: backend/Dockerfile
  - web_server    → Dockerfile: web/Dockerfile
  - background    → Dockerfile: backend/Dockerfile
  - model_server  → Dockerfile: backend/Dockerfile.model_server
  - opensearch    → Image: opensearchproject/opensearch:3.4.0
```

### 4. Set Environment Variables

In Railway's **Variables** tab for each service, add these shared variables:

```
SECRET_KEY=<generate: openssl rand -hex 32>
ENCRYPTION_KEY_SECRET=<generate: openssl rand -hex 32>
OPENSEARCH_ADMIN_PASSWORD=<strong password, min 8 chars, mixed case + number + symbol>
WEB_DOMAIN=<your Railway web_server public URL, e.g. https://colnitia-onyx.up.railway.app>
```

For `web_server`, also add:
```
INTERNAL_URL=http://api_server.railway.internal:8080
```

For `api_server` and `background`, also add:
```
MODEL_SERVER_HOST=http://model_server.railway.internal
MODEL_SERVER_PORT=9000
```

### 5. Add a Volume for OpenSearch Persistence

In the `opensearch` service → **Settings → Volumes**:
- Mount path: `/usr/share/opensearch/data`

> ⚠️ Without this volume, OpenSearch data is lost on every redeploy.

### 6. Set Domain / Public URL

In the `web_server` service → **Settings → Networking** → **Generate Domain**.
Copy that URL and paste it into the `WEB_DOMAIN` environment variable.

---

## Validation Checklist

After all services show **Running** in the Railway dashboard:

- [ ] `https://<WEB_DOMAIN>/` loads the Colnitia login page
- [ ] Create account → log in successfully
- [ ] Upload a PDF document
- [ ] Ask a question about the PDF → response cites the document (RAG working)
- [ ] Railway Metrics → no service shows memory usage > 90%

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---|---|---|
| `api_server` crashes on start | Missing `SECRET_KEY` | Add env var in Railway |
| OpenSearch OOM | Java heap too large | `OPENSEARCH_JAVA_OPTS=-Xms512m -Xmx512m` (reduce if needed) |
| RAG returns no results | `model_server` not reachable | Verify `MODEL_SERVER_HOST` uses Railway internal DNS |
| Frontend shows "Internal Server Error" | Wrong `INTERNAL_URL` | Use Railway internal hostname: `http://api_server.railway.internal:8080` |
