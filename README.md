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

## Health check

`GET /api/health` returns `{ "status": "ok", "deploymentSha": "<sha>" }` and is used by the
Azure App Service deployment workflow. The endpoint is unauthenticated and matches
`infra/main.bicep`'s `healthCheckPath`.

## Telemetry

Application Insights is wired via `app/lib/telemetry.ts`. When the
`APPLICATIONINSIGHTS_CONNECTION_STRING` app setting is present (provisioned by
`infra/main.bicep`), server-side events — including each `/api/health` call — are
tagged with a `deploymentSha` property resolved from `DEPLOYMENT_SHA`, `GITHUB_SHA`,
`WEBSITE_SHA`, or Azure's `SCM_COMMIT_ID`, in that order, falling back to `"unknown"`.
Telemetry calls are a no-op when no connection string is configured (e.g. local
development).