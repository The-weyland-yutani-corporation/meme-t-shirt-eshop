import assert from "node:assert/strict";
import { test } from "node:test";
import { MockPrintProviderAdapter } from "../../catalog/adapters/mock-adapter.ts";
import { parseQuantity, reviewPurchase, simulationUrl } from "../simulation.ts";

const variantId = "classic-meme-tee-s-black";

test("simulation calculates catalog totals and is deterministic across repeated flows", async () => {
  const first = await reviewPurchase(variantId, "2");
  assert.equal(first.totalCents, 4998);
  assert.equal(first.quantity, 2);
  assert.deepEqual(await reviewPurchase(variantId, 2), first);
  assert.notEqual((await reviewPurchase(variantId, 1)).reference, first.reference);
});

test("quantities reject fractions, coercion, overflow and malicious values", () => {
  for (const value of [undefined, null, true, 0, -1, 1.5, 11, NaN, Infinity, {}, [], "1.5", "1e1", "2x", "01", " 2", "2 ", "0x2", "9007199254740992"]) {
    assert.throws(() => parseQuantity(value), /whole-number/);
  }
  assert.equal(parseQuantity(10), 10);
});

test("unknown variants and unavailable stock fail review", async () => {
  for (const id of ["missing", "", null, ["classic-meme-tee-s-black"], "limited-drop-hoodie-l-grey"]) {
    await assert.rejects(() => reviewPurchase(id, 1));
  }
});

test("completion rechecks provider availability instead of trusting an earlier review", async () => {
  await reviewPurchase(variantId, 1);
  const provider = new MockPrintProviderAdapter({ unavailableVariantIds: [variantId] });
  await assert.rejects(() => reviewPurchase(variantId, 1, provider), /unavailable/);
});

test("review, completed and cancelled destinations are local and distinct", () => {
  assert.equal(simulationUrl(variantId, 2), `/checkout?variantId=${variantId}&quantity=2`);
  for (const status of ["completed", "cancelled"] as const) {
    const url = new URL(simulationUrl(variantId, 2, status), "https://demo.example");
    assert.equal(url.pathname, "/orders");
    assert.equal(url.searchParams.get("status"), status);
  }
});
