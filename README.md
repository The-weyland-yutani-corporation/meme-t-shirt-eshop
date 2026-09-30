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

`GET /api/health` returns `{ "status": "ok" }` and is used by the Azure App Service deployment workflow.