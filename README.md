# meme-t-shirt-eshop

A Next.js (App Router, TypeScript) storefront application.

## Package manager

This project uses **npm** (see `package-lock.json`).

## Scripts

- `npm run dev` — start the development server
- `npm run build` — build the production application
- `npm run start` — run the production build
- `npm run lint` — run ESLint
- `npm run typecheck` — run the TypeScript compiler in no-emit mode
- `npm run test` — run catalog/adapter contract tests (Node's built-in test runner)

## Catalog & fulfillment adapter

`lib/catalog/` defines the storefront content model (`Category`, `Tag`,
`Product`, `ProductVariant`) and a `PrintProviderAdapter` interface that
isolates catalog/checkout code from any specific print-on-demand
fulfillment provider. `lib/catalog/adapters/mock-adapter.ts` provides a
faithful in-memory `MockPrintProviderAdapter` so catalog and checkout
features can be built and tested without live Printful calls or
credentials. Contract tests in
`lib/catalog/adapters/__tests__/provider-adapter.contract.test.ts`
verify the mock (and any future real adapter) against the documented
interface behavior.

## Health check

`GET /api/health` returns `{ "status": "ok" }` and is used by the Azure App Service deployment workflow.