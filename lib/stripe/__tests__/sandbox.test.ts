import assert from "node:assert/strict";
import { test } from "node:test";
import { checkoutDestination, sandboxCheckoutInput } from "../sandbox.ts";

const origin = "https://demo.example";
const line = { variantId: "classic-meme-tee-s-black", quantity: 2 };
const input = { lineItems: [line], successUrl: "/orders", cancelUrl: "/catalog" };

test("sandbox derives product name, currency and price from server catalog", async () => {
  const result = await sandboxCheckoutInput(input, origin);
  assert.equal(result.line_items[0].price_data.unit_amount, 2499);
  assert.equal(result.line_items[0].quantity, 2);
  assert.equal(result.line_items[0].price_data.currency, "usd");
  assert.equal(result.success_url, `${origin}/orders`);
});

test("sandbox rejects untrusted quantities, prices and unavailable variants", async () => {
  for (const item of [
    { ...line, quantity: 1.5 }, { ...line, quantity: "2" }, { ...line, quantity: -2 },
    { ...line, quantity: 0 }, { ...line, quantity: 1000000 },
    { ...line, amount: 1 }, { ...line, currency: "eur" },
    { ...line, variantId: "missing" }, { ...line, variantId: "limited-drop-hoodie-l-grey" },
    { name: "Fake", amount: 1, quantity: 1 },
  ]) await assert.rejects(() => sandboxCheckoutInput({ ...input, lineItems: [item] }, origin));
  for (const body of [null, {}, { ...input, lineItems: [] }, { ...input, lineItems: Array(11).fill(line) }]) {
    await assert.rejects(() => sandboxCheckoutInput(body, origin));
  }
});

test("destinations reject cross-origin, credentials, unexpected paths, query and fragments", () => {
  for (const value of [
    "https://evil.example/orders", "//evil.example/orders", "javascript:alert(1)",
    "https://user@demo.example/orders", "/api/checkout", "/orders?redirect=https://evil.example",
    "/orders#fragment", "/%2f%2fevil.example", null,
  ]) assert.throws(() => checkoutDestination(value, origin));
  assert.equal(checkoutDestination("/checkout", origin), `${origin}/checkout`);
});
