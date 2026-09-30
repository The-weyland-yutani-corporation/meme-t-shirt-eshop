# meme-t-shirt-eshop

A Next.js (App Router) storefront application, built with Node 22.

## Getting started

Package manager: **npm** (see `package-lock.json`, committed as the canonical lockfile).

```bash
npm install
npm run dev
```

## Scripts

- `npm run dev` — start the local development server.
- `npm run build` — create a production build.
- `npm run start` — run the production build.
- `npm run lint` — lint the codebase with ESLint.
- `npm run typecheck` — run the TypeScript compiler in no-emit mode.

## Health check

`GET /api/health` returns `{ "status": "ok" }` and is used by the Azure App Service deployment workflow.
