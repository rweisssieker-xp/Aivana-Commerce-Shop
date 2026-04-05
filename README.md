# Aivana Commerce Shop

API-first, multi-tenant commerce backend with a minimal **AI basement** (keyword search with citations today; embeddings-ready).

## Prerequisites

- Node.js 22+
- [pnpm](https://pnpm.io/) 9+ (`corepack enable` or `npx pnpm`)
- Docker (for PostgreSQL), or your own Postgres 16

## Quickstart (10 minutes)

1. Copy environment:

   ```bash
   cp .env.example .env
   ```

2. Start PostgreSQL:

   ```bash
   docker compose up -d
   ```

3. Install and migrate:

   ```bash
   pnpm install
   pnpm db:migrate
   pnpm db:seed
   ```

4. Run the API:

   ```bash
   pnpm --filter @aivana/api dev
   ```

5. Call the API (use the `apiKey` printed by `db:seed`):

   ```bash
   curl -s -H "X-API-Key: YOUR_KEY" "http://localhost:3000/v1/products"
   curl -s -H "X-API-Key: YOUR_KEY" "http://localhost:3000/v1/search?q=Demo"
   ```

- OpenAPI UI: `http://localhost:3000/docs`
- Health: `GET /health/live`, `GET /health/ready`

## Monorepo layout

- `apps/api` — Fastify + Prisma + commerce routes (`/v1/products`, `/v1/carts`, `/v1/search`, `/v1/webhooks/endpoints`)

## Webhooks (outbox)

1. Register an endpoint (secret is returned **once**):

   ```bash
   curl -s -X POST -H "X-API-Key: YOUR_KEY" -H "Content-Type: application/json" \
     -d "{\"url\":\"https://example.com/hooks\",\"events\":[\"order.created\"]}" \
     "http://localhost:3000/v1/webhooks/endpoints"
   ```

2. On checkout, an `order.created` event is written to the **outbox**; the worker (poll interval `OUTBOX_POLL_MS`, default 3000) POSTs JSON to your URL with headers:

   - `x-aivana-event-type`, `x-aivana-event-id`, `x-aivana-delivery-id`
   - `x-aivana-signature: sha256=<hex>` — HMAC-SHA256 of the **raw body** with your endpoint `secret`

3. List or delete: `GET /v1/webhooks/endpoints`, `DELETE /v1/webhooks/endpoints/:id`
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
