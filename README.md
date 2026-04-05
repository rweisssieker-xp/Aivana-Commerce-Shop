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

- `apps/api` — Fastify + Prisma + commerce routes (`/v1/products`, `/v1/carts`, `/v1/search`)
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
- Tenant isolation is enforced in application queries; enable Postgres RLS in production as a follow-up.

## License

Private / unlicensed — adjust for your product.
