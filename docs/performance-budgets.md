# Performance budgets

The storefront enforces a per-route first-load JS performance budget as part
of the build.

## Budget

| Metric | Budget |
| --- | --- |
| First-load JS (gzipped), per route | 180KB |

## Enforcement

`npm run build` runs `next build`, then automatically runs the `postbuild`
script (`scripts/performance-budget.mjs`), which:

1. Reads Turbopack's build diagnostics (`.next/diagnostics/route-bundle-stats.json`,
   `firstLoadChunkPaths` per route).
2. Gzips each route's first-load JS files and sums their sizes.
3. Prints a per-route report.
4. Exits non-zero (failing the build, including in CI) if any route exceeds
   the 180KB budget.

If the diagnostics file is not present (e.g. an older Next.js version that
doesn't emit it), the check logs a warning and skips rather than failing the
build.

## Updating the budget

Change `DEFAULT_BUDGET_BYTES` in `scripts/performance-budget.mjs` if the
budget needs to change, and update the table above to match.
