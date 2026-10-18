import assert from "node:assert/strict";
import { test } from "node:test";
import { gzipSync } from "node:zlib";
import crypto from "node:crypto";
import { checkBudget, gzippedSize, DEFAULT_BUDGET_BYTES } from "./performance-budget.mjs";

test("gzippedSize sums gzipped buffer sizes", () => {
  const buffers = [Buffer.from("a".repeat(1000)), Buffer.from("b".repeat(1000))];
  const expected = gzipSync(buffers[0]).length + gzipSync(buffers[1]).length;
  assert.equal(gzippedSize(buffers), expected);
});

test("checkBudget flags routes exceeding the budget", async () => {
  const smallContent = Buffer.from("x".repeat(100));
  // Use random (incompressible) bytes so gzip doesn't shrink this below
  // the budget — repeated characters would compress to almost nothing.
  const largeContent = crypto.randomBytes(DEFAULT_BUDGET_BYTES * 2);

  const stats = [
    { route: "/small", firstLoadFiles: ["small.js"] },
    { route: "/large", firstLoadFiles: ["large.js"] },
  ];

  const results = await checkBudget(stats, async (filePath) =>
    filePath === "small.js" ? smallContent : largeContent
  );

  const small = results.find((r) => r.route === "/small");
  const large = results.find((r) => r.route === "/large");

  assert.equal(small.overBudget, false);
  assert.equal(large.overBudget, true);
});

test("checkBudget respects a custom budget", async () => {
  const content = Buffer.from("z".repeat(500));
  const stats = [{ route: "/custom", firstLoadFiles: ["custom.js"] }];

  const results = await checkBudget(stats, async () => content, 10);

  assert.equal(results[0].overBudget, true);
});
