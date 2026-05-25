# CranL Runtime

CranL is Souqna's standalone Node.js runtime for Souqy Studio AI workloads and background generation tasks. The main Souqna frontend stays on Vercel; CranL is deployed separately wherever long-running workers, Redis queues, GPU-adjacent services, or private AI providers can run safely.

## What It Runs

- API health and observability endpoints.
- Redis-backed BullMQ queues for generation tasks.
- Worker processes for image generation and LLM/chat jobs.
- Provider abstractions for OpenAI, Ollama, and Hugging Face.
- Pipeline modules that keep queue workers small and provider-agnostic.

## Queues

- `image-generation`
- `video-generation`
- `audio-processing`
- `upscale-processing`
- `ai-chat`
- `svg-processing`

## Local Development

```bash
cd apps/cranl-runtime
npm install
npm run dev
```

New local environments should create `.env` manually from your private secret manager.

Run workers in a second terminal when developing queue processors:

```bash
npm run build
npm run worker
```

For hot-reloading workers during development:

```bash
npm run worker:dev
```

CranL expects Redis to be available at `REDIS_URL`. A local default is:

```bash
docker run --rm -p 6379:6379 redis:7-alpine
```

## Endpoints

```text
GET /health
GET /workers
GET /queues
POST /jobs/image-generation
POST /jobs/ai-chat
GET /jobs/:queue/:jobId
```

`/queues` reports BullMQ job counts for every CranL queue. `/workers` reports the worker definitions compiled into this service.
Job submission and status endpoints require `Authorization: Bearer <CRANL_API_KEY>`.

## Docker

Build the runtime container:

```bash
docker build -t cranl-runtime .
```

Run the API and workers together:

```bash
docker run --rm -p 3000:3000 --env-file .env cranl-runtime
```

Run only workers from the same image if your host splits API and worker services:

```bash
docker run --rm --env-file .env cranl-runtime npm run worker
```

## Deployment

CranL is independently deployable from the main Souqna frontend:

1. Deploy the Souqna frontend to Vercel as usual.
2. Deploy `apps/cranl-runtime` to a separate Node-capable host.
3. Attach a managed Redis instance and set `REDIS_URL`.
4. Set provider credentials such as `OPENAI_API_KEY`, `OLLAMA_URL`, and `HUGGINGFACE_API_KEY`.
5. Run the default Docker command or `npm start` to start the API and workers together.
6. If the host supports separate service roles, run API with `npm run start:api` and workers with `npm run worker`.

Scale API and worker processes separately when the host supports multiple process roles. Workers can be placed on machines with provider access, GPU access, or private network access without changing the frontend deployment.

## Environment

```text
PORT=3000
NODE_ENV=production
LOG_LEVEL=info
CRANL_API_KEY=
REDIS_URL=
OPENAI_API_KEY=
OLLAMA_URL=
HUGGINGFACE_API_KEY=
BLOB_READ_WRITE_TOKEN=
WORKER_CONCURRENCY=2
```
