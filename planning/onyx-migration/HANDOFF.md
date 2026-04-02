# Colnitia-Onyx Migration — HANDOFF Document

> Last updated: 2026-04-01 · Sprint 6 Deploy in progress. 5 servicios creados en Railway, todos con errores — diagnóstico incluido abajo.

---

## Overview

Six-sprint migration from **Colnitia GPT** (Open-WebUI fork, `colnitio_gpt`) → **Colnitia-Onyx** (Onyx fork, `colnitia-onyx`). Sprints 1-3 complete, Sprint 6 (Deployment) active.

---

## Sprint Status

| Sprint | Name                       | Status       |
| ------ | -------------------------- | ------------ |
| 1      | Infrastructure Bootstrap   | ✅ Complete  |
| 2      | Rebranding                 | ✅ Complete  |
| 3      | Theme System               | ✅ Complete  |
| 4      | Budget System              | ⏭️ Skipped  |
| 5      | Advanced Connectors        | ⏭️ Skipped  |
| 6      | Deployment & Cutover       | 🔴 Errors   |

---

## Railway Project

- **URL**: https://railway.com/project/eef2a067-2a78-459d-97e1-e394a6fdd66e
- **Project**: astonishing-smile
- **Environment**: production

---

## Current Service Status & Errors

| Service | ID | Status | Error |
|---|---|---|---|
| `Postgres` | e048db09 | ✅ SUCCESS | — |
| `Redis` | 74b7c7bd | ✅ SUCCESS | — |
| `cognitia` (Open-WebUI viejo) | 0bf59588 | ✅ SUCCESS | Mantener como fallback |
| `opensearch` | b8742a61 | 🔴 CRASHED | No lee `OPENSEARCH_INITIAL_ADMIN_PASSWORD` |
| `colnitia-onyx` (api_server) | 4b673eb0 | 🔴 FAILED | No usa Dockerfile, detecta Python genérico |
| `web_server` | 361606f3 | 🔴 FAILED | "Cache mounts MUST be in format..." |
| `background` | N/A | ⬚ NO DEPLOY | No tiene source/repo conectado |
| `model_server` | N/A | ⬚ NO DEPLOY | No tiene source/repo conectado |

---

## Error Diagnosis & Fixes

### 🔴 OpenSearch: "No custom admin password found"

**Causa**: La variable `OPENSEARCH_INITIAL_ADMIN_PASSWORD` fue seteada via CLI pero OpenSearch no la está leyendo. Posiblemente Railway la inyecta en runtime pero OpenSearch la necesita en el entrypoint.

**Fix**:
1. En Railway dashboard → servicio `opensearch` → Variables
2. Verificar que existe: `OPENSEARCH_INITIAL_ADMIN_PASSWORD=Colnitia2026!Secure`
3. Si existe, puede ser un problema de la imagen. Intentar con password más simple sin caracteres especiales: `OPENSEARCH_INITIAL_ADMIN_PASSWORD=Colnitia2026Secure1`
4. También verificar que `discovery.type=single-node` está seteado (sin esto OpenSearch busca cluster)
5. Redeploy: `railway service redeploy --service opensearch`

### 🔴 colnitia-onyx (api_server): "No start command detected"

**Causa**: Railway no está usando el Dockerfile. Detecta Python genérico con Railpack en vez de usar `backend/Dockerfile`.

**Fix** (en Railway dashboard → servicio `colnitia-onyx` → Settings):
1. **Source** → Connect repo `jsebastianquiroga/colnitia-onyx`, branch `colnitia/main`
2. **Build** → Builder: **Dockerfile** (NO Railpack/Nixpacks)
3. **Dockerfile Path**: `backend/Dockerfile`
4. **Start Command**: `/bin/sh -c "alembic upgrade head && uvicorn onyx.main:app --host 0.0.0.0 --port 8080"`
5. **Watch Paths**: dejar vacío o `/backend`
6. Redeploy

### 🔴 web_server: "Cache mounts MUST be in format..."

**Causa**: El `web/Dockerfile` usa `--mount=type=cache` en `RUN` statements, lo cual no es compatible con el builder de Railway.

**Fix opciones**:
- **Opción A** (preferida): En Settings → Builder, seleccionar **Dockerfile** en vez de Railpack/Nixpacks, y asegurar que `DOCKER_BUILDKIT=1` está habilitado
- **Opción B**: Editar `web/Dockerfile` en el fork para remover las líneas `--mount=type=cache` (funciona pero pierde optimización de cache)
- **Config en dashboard**:
  1. Source → repo `colnitia-onyx`, branch `colnitia/main`
  2. Root Directory: `/web` (o vacío si Dockerfile Path incluye `web/`)
  3. Builder: **Dockerfile**
  4. Dockerfile Path: `web/Dockerfile`

### ⬚ background & model_server: No deployment

**Causa**: Fueron creados como "Empty Service" — no tienen source/repo conectado.

**Fix** (para cada uno, en Settings):
1. **Source** → Connect repo `jsebastianquiroga/colnitia-onyx`, branch `colnitia/main`
2. Builder: **Dockerfile**

Para `background`:
- Dockerfile Path: `backend/Dockerfile`
- Start Command: `/bin/sh -c "/app/scripts/supervisord_entrypoint.sh"`

Para `model_server`:
- Dockerfile Path: `backend/Dockerfile.model_server`
- Root Directory: `/backend`

---

## Variables de Entorno (ya configuradas via CLI)

Todas las variables fueron seteadas con `railway variable set --skip-deploys`. Verificar en dashboard que existen:

### Compartidas (api_server, background)
```
SECRET_KEY=6a713d014b549cb1b9d7883fcb228995311d4d13afdfc6c2b0a184fea9c48c8d
ENCRYPTION_KEY_SECRET=47fb7bf044fa01a34410446b57b88c9f7a2729e9f8fe4ae724daa40b36974138
POSTGRES_HOST=postgres.railway.internal
POSTGRES_PORT=5432
POSTGRES_DB=railway
POSTGRES_USER=postgres
POSTGRES_PASSWORD=LNTEEkkIgBaCfkNAgzEmVqdzCQOOnVqm
REDIS_HOST=redis.railway.internal
REDIS_PORT=6379
REDIS_PASSWORD=VHVAxHpotTiQnsVZoaZoADEUFridMJYJ
OPENSEARCH_HOST=opensearch.railway.internal
OPENSEARCH_PORT=9200
OPENSEARCH_ADMIN_PASSWORD=Colnitia2026!Secure
ENABLE_OPENSEARCH_INDEXING_FOR_ONYX=true
ENABLE_OPENSEARCH_RETRIEVAL_FOR_ONYX=true
MODEL_SERVER_HOST=http://model_server.railway.internal
MODEL_SERVER_PORT=9000
FILE_STORE_BACKEND=local
LOG_LEVEL=info
AUTH_TYPE=basic
```

### web_server
```
INTERNAL_URL=http://colnitia-onyx.railway.internal:8080
PORT=3000
NODE_ENV=production
```

### model_server
```
MIN_THREADS_ML_MODELS=1
INDEXING_ONLY=false
```

### opensearch
```
discovery.type=single-node
OPENSEARCH_INITIAL_ADMIN_PASSWORD=Colnitia2026!Secure
bootstrap.memory_lock=true
OPENSEARCH_JAVA_OPTS=-Xms1g -Xmx1g
```

---

## ⚠️ INTERNAL_URL: Nombre de servicio

El `web_server` tiene `INTERNAL_URL=http://colnitia-onyx.railway.internal:8080`. Esto usa el nombre de servicio de Railway para el api_server. Si renombras el servicio `colnitia-onyx` a `api_server`, actualiza esta variable a `http://api_server.railway.internal:8080`.

---

## Orden de Deploy Recomendado

Una vez configurados los Dockerfiles en el dashboard:

1. **opensearch** → esperar SUCCESS
2. **model_server** → esperar SUCCESS (necesita descargar modelos, puede tardar 5-10 min)
3. **colnitia-onyx** (api_server) → esperar SUCCESS (corre alembic, crea tablas)
4. **background** → esperar SUCCESS
5. **web_server** → esperar SUCCESS → generar domain

---

## Migración de Usuarios

Script listo en: `scripts/migrate_users.py`

**Ejecutar DESPUÉS de que api_server haya corrido alembic** (crea tablas Onyx):

```bash
# Desde Railway shell o localmente con acceso a la DB
# Dry-run primero:
python scripts/migrate_users.py \
  --source "postgresql://postgres:LNTEEkkIgBaCfkNAgzEmVqdzCQOOnVqm@<POSTGRES_PUBLIC_HOST>/railway" \
  --target "postgresql://postgres:LNTEEkkIgBaCfkNAgzEmVqdzCQOOnVqm@<POSTGRES_PUBLIC_HOST>/railway"

# Ejecutar migración:
python scripts/migrate_users.py --execute \
  --source "..." --target "..."
```

Nota: Para correr localmente necesitas el host público de Postgres (no el internal). Encuéntralo en Railway → Postgres → Variables → `DATABASE_PUBLIC_URL`.

---

## DNS Cutover

Una vez todo funcione:
1. En Railway → `web_server` → Settings → Custom Domain → `gpt.colnitia.com`
2. Configurar CNAME en tu DNS provider apuntando al dominio Railway
3. Esperar propagación DNS (~5 min)
4. Verificar: `curl -s -o /dev/null -w "%{http_code}" https://gpt.colnitia.com`
5. Mantener `cognitia` (Open-WebUI) corriendo 7 días como fallback

---

## Repos

| Repo | Path Local | Branch |
|---|---|---|
| colnitio_gpt (Open-WebUI actual) | ~/Desktop/Estudio/MAIN/GIT/colnitio_gpt/ | main |
| colnitia-onyx (Onyx fork) | ~/Desktop/Estudio/MAIN/GIT/colnitia-onyx/ | colnitia/main |

---

## Para Continuar en Nueva Sesión

```
Lee este archivo: planning/onyx-migration/HANDOFF.md

El deploy de Colnitia-Onyx en Railway tiene errores. 
El diagnóstico y fixes están documentados arriba.
Aplica los fixes en el dashboard de Railway y redeploya cada servicio.
Proyecto: https://railway.com/project/eef2a067-2a78-459d-97e1-e394a6fdd66e
```
