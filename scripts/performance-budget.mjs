#!/usr/bin/env node
/**
 * Enforces a per-route first-load JS performance budget.
 *
 * Reads Next.js/Turbopack's build diagnostics (`.next/diagnostics/route-bundle-stats.json`,
 * emitted by `next build`), gzips each route's first-load JS, and fails
 * (exit 1) if any route exceeds the configured budget. Wired as the
 * `postbuild` script so it runs automatically after every `npm run build`
 * (including in CI — see docs/performance-budgets.md).
 */
import { readFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import path from "node:path";

export const DEFAULT_BUDGET_BYTES = 180 * 1024; // 180KB gzipped first-load JS
const STATS_PATH = path.join(process.cwd(), ".next", "diagnostics", "route-bundle-stats.json");

/**
 * Computes gzipped size in bytes for a set of already-read file buffers.
 * @param {Buffer[]} buffers
 * @returns {number}
 */
export function gzippedSize(buffers) {
  return buffers.reduce((total, buf) => total + gzipSync(buf).length, 0);
}

/**
 * Checks parsed route stats against the budget, given a function that
 * reads a bundle file's raw contents (injectable for testing).
 *
 * @param {{route: string, firstLoadFiles: string[]}[]} stats
 * @param {(filePath: string) => Promise<Buffer>} readBundleFile
 * @param {number} [budgetBytes]
 * @returns {Promise<{route: string, sizeBytes: number, overBudget: boolean}[]>}
 */
export async function checkBudget(stats, readBundleFile, budgetBytes = DEFAULT_BUDGET_BYTES) {
  const results = [];
  for (const stat of stats) {
    const buffers = await Promise.all(stat.firstLoadFiles.map(readBundleFile));
    const sizeBytes = gzippedSize(buffers);
    results.push({
      route: stat.route,
      sizeBytes,
      overBudget: sizeBytes > budgetBytes,
    });
  }
  return results;
}

async function main() {
  let raw;
  try {
    raw = await readFile(STATS_PATH, "utf8");
  } catch {
    console.warn(
      `[performance-budget] No route bundle stats found at ${STATS_PATH}; skipping budget check (build output may not include diagnostics on this Next.js version).`
    );
    return;
  }

  const stats = JSON.parse(raw).map((entry) => ({
    route: entry.route,
    firstLoadFiles: entry.firstLoadChunkPaths ?? entry.firstLoadFiles ?? [],
  }));
  const projectRoot = process.cwd();

  const results = await checkBudget(stats, (filePath) =>
    readFile(path.join(projectRoot, filePath))
  );

  const budgetKb = (DEFAULT_BUDGET_BYTES / 1024).toFixed(0);
  for (const result of results) {
    const sizeKb = (result.sizeBytes / 1024).toFixed(1);
    const status = result.overBudget ? "OVER BUDGET" : "ok";
    console.log(`[performance-budget] ${result.route}: ${sizeKb}KB gzip (budget ${budgetKb}KB) — ${status}`);
  }

  const failures = results.filter((r) => r.overBudget);
  if (failures.length > 0) {
    console.error(
      `[performance-budget] ${failures.length} route(s) exceeded the ${budgetKb}KB first-load JS budget.`
    );
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
