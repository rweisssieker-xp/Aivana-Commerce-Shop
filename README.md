# Aivana Commerce Shop

API-first, multi-tenant commerce backend with **webhooks (outbox)**, **B2B organizations**, **order timeline**, **Redis + BullMQ** for async product embeddings, and **hybrid search** (keyword + OpenAI embeddings when `OPENAI_API_KEY` is set).

## Prerequisites

- Node.js 22+
- [pnpm](https://pnpm.io/) 9+ (`corepack enable` or `npx pnpm`)
- **PostgreSQL 16+** (lokal oder gehostet) — Connection-String in `.env` als `DATABASE_URL`
- Optional: **Redis 7+** für Embedding-Queue (`REDIS_URL`) — ohne Redis funktioniert der Rest, Embeddings werden nur nicht in die Queue gelegt

## Quickstart

1. Copy environment:

   ```bash
   cp .env.example .env
   ```

   Passe `DATABASE_URL` an deine Postgres-Instanz an. Setze `OPENAI_API_KEY` für semantische/hybride Suche und automatische Embeddings nach Produkt-Anlage/-Update. Optional `REDIS_URL` (z. B. `redis://127.0.0.1:6379`).

2. Install and migrate:

   ```bash
   pnpm install
   pnpm db:migrate
   pnpm db:seed
   ```

3. Run the API:

   ```bash
   pnpm --filter @aivana/api dev
   ```

4. Example calls (use `apiKey` from `db:seed`):

   ```bash
   curl -s -H "X-API-Key: YOUR_KEY" "http://localhost:3000/v1/products"
   curl -s -H "X-API-Key: YOUR_KEY" "http://localhost:3000/v1/search?q=Demo"
   curl -s -H "X-API-Key: YOUR_KEY" "http://localhost:3000/v1/orders"
   ```

- OpenAPI UI: `http://localhost:3000/docs`
- Health: `GET /health/live`, `GET /health/ready`

## Features (high level)

| Area | Endpoints / behavior |
|------|----------------------|
| Products | `POST/GET/PATCH /v1/products` — embedding jobs queued when `REDIS_URL` is set |
| Search | `GET /v1/search?q=` — keyword + optional hybrid merge with embeddings |
| Carts / checkout | `POST /v1/carts/.../checkout` — optional `{ "organizationId" }` body |
| Orders | `GET /v1/orders`, `GET /v1/orders/:id` (includes **timeline** `events`), `PATCH /v1/orders/:id` (`status`) |
| B2B orgs | `POST/GET /v1/organizations`, `POST /v1/organizations/:id/members` |
| Webhooks | `POST/GET/DELETE /v1/webhooks/endpoints` — outbox + HMAC delivery |

## Redis and embeddings

With `REDIS_URL` (see `.env.example`), **BullMQ** runs an **embed worker** that indexes products into `ProductEmbedding` using OpenAI `text-embedding-3-small`. Without Redis, embed jobs are not queued (search still works on keywords).

## Webhooks (outbox)

1. Register an endpoint (secret returned **once**):

   ```bash
   curl -s -X POST -H "X-API-Key: YOUR_KEY" -H "Content-Type: application/json" \
     -d "{\"url\":\"https://example.com/hooks\",\"events\":[\"order.created\"]}" \
     "http://localhost:3000/v1/webhooks/endpoints"
   ```

2. On checkout, `order.created` is written to the outbox and an **order timeline** row is created. A poller (`OUTBOX_POLL_MS`, default 3000 ms) delivers signed `POST` requests with:

   - `x-aivana-event-type`, `x-aivana-event-id`, `x-aivana-delivery-id`
   - `x-aivana-signature: sha256=<hex>` — HMAC-SHA256 of the **raw JSON body** with the endpoint `secret`

## Monorepo layout

- `apps/api` — Fastify + Prisma + BullMQ
- `packages/shared-types` — shared TypeScript types

## Scripts

| Script | Description |
|--------|-------------|
| `pnpm dev` | Turbo dev (API watch) |
| `pnpm build` | Build all packages |
| `pnpm test` | Run tests |
| `pnpm db:migrate` | Prisma migrate (dev) |
| `pnpm db:seed` | Seed demo tenant + API key + product |

## Security notes

- API keys are stored **hashed** (SHA-256); the plain key is only shown once from `db:seed`.
- Webhook signing secrets are stored **in plaintext** (needed for HMAC); treat like API keys and encrypt-at-rest in production.
- Tenant isolation is enforced in application queries; enable Postgres RLS in production as a follow-up.

## License

Private / unlicensed — adjust for your product.
