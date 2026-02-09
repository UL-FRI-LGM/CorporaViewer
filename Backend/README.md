# corpora-viewer-backend-v2

Short overview
- Backend service for a Parlavis.si project (TypeScript / Node).
- Uses Elasticsearch for search indexes. Two Docker composition modes:
    - Development \(`docker-setup/docker-compose-dev.yml`\): runs Elasticsearch + Kibana. Kibana is useful for debugging ES (UI). This dev compose does *not* start the API image — the API must be run locally for development.
    - Production \(`docker-setup/docker-compose-prod.yml`\): runs Elasticsearch and the `260620021/parlavis-api:latest` API image from the Docker registry. No Kibana included.

Repository layout (important files/folders)
- `app.ts` — application entry (TypeScript).
- `api/` — Express controllers and routers for endpoints.
  - `database/` — ES client initialization.
  - `repositories/` — data access layer for different indexes.
- `models/` — TypeScript models / request/response types.
- `strategies/` — runtime strategy selectors for search / file serving.
- `utils/` and `builders/` — helper utilities and builders.
- `docker-setup/` — contains `docker-compose-dev.yml` and `docker-compose-prod.yml`.
- `Dockerfile`, `package.json`, `tsconfig.json` — project basics.

Prerequisites
- Docker & Docker Compose installed.
- Node.js (for local API development) and npm.

Environment variables used by docker-compose.
Both compose files rely on environment variables (example names shown):
- `STACK_VERSION` — Elasticsearch / Kibana docker tag (project's desired version is `8.15.1`).
- `ES_PORT` — host port for Elasticsearch (default: `9200`).
- `KIBANA_PORT` (dev only) — host port for Kibana (default: `5601`).
- `API_PORT` (prod api service) — host port for API service (default: `3000`).
- `CLUSTER_NAME` — Elasticsearch cluster name.
- `MEM_LIMIT` — memory limit for container (default: `4294967296` bytes).
- `MEETINGS_INDEX_NAME`, `WORDS_INDEX_NAME`, `SENTENCES_INDEX_NAME` — names of the Elasticsearch indexes.
- `PATH_TO_DATA` — mapped path on host where pdfs, thumbnails and other files are stored.

First create `.env` file and place it in the root directory. Example minimal `.env` for development:
```
# Version of Elastic products
STACK_VERSION=8.15.1

# Cluster name
CLUSTER_NAME=parlavis-si

# Port to expose Elasticsearch HTTP API to the host
ES_PORT=9200

# Port to expose Kibana to the host
KIBANA_PORT=5601

# Port to expose API to the host
API_PORT=3000

# Increase or decrease based on the available host memory (in bytes)
MEM_LIMIT=4294967296

# Project namespace (defaults to the current folder name if not set)
COMPOSE_PROJECT_NAME=parlavis-si

# Indices names
MEETINGS_INDEX_NAME=meetings-index
WORDS_INDEX_NAME=words-index
SENTENCES_INDEX_NAME=sentences-index

# Path to PDF files and thumbnails (on the host machine)
PATH_TO_DATA=<YOUR_PATH_HERE>
```

## Dev: how to run locally and with Docker
1. Prepare environment:
    - From project root create the `.env` with variables above.
    - Ensure Docker Desktop is running.

2. Start Elasticsearch + Kibana (development):
    - In project root run:
      ```
      docker-compose -f docker-setup/docker-compose-dev.yml up -d
      ```
    - This starts `es01` and `kibana`. Kibana is useful to inspect indices and debug mappings / queries.

3. Run API locally (dev compose does not include API):
    - Install dependencies:
      ```
      npm install
      ```
      - Run project in development mode:
      ```
      npm run dev
      ```
    - API should be configured to connect to `ELASTICSEARCH_HOSTS=http://localhost:9200` (or update `.env`/process env used by app). Confirm the port mapping `ES_PORT` used above.

4. Access Kibana (optional):
    - Open `http://localhost:${KIBANA_PORT}` (default `5601`) to inspect Elasticsearch indices and run queries.
