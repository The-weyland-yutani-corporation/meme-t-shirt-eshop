/**
 * Contract tests for PrintProviderAdapter implementations.
 *
 * These tests exercise the adapter interface's documented behavior
 * so that any implementation (starting with the mock, later a real
 * Printful adapter) can be verified against the same contract.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { MockPrintProviderAdapter } from "../mock-adapter.ts";
import { ProviderNotFoundError, ProviderOrderError } from "../types.ts";
import type { PrintProviderAdapter } from "../types.ts";
import { loadCatalogConfig } from "../../content/catalog-config.ts";

function makeAdapter(): PrintProviderAdapter {
  return new MockPrintProviderAdapter();
}

test("default mock catalog matches validated content and cannot be mutated by callers", async () => {
  const adapter = makeAdapter();
  const products = await adapter.listProducts();
  assert.deepEqual(products, (await loadCatalogConfig()).products);
  products[0].variants[0].priceCents = 1;
  assert.equal((await adapter.getVariant(products[0].variants[0].id)).priceCents, 2499);
});

test("mock orders reject unavailable variants and non-integer or excessive quantities", async () => {
  const adapter = makeAdapter();
  for (const quantity of [1.5, NaN, Infinity, 11]) {
    await assert.rejects(() => adapter.createOrder([{ variantId: "classic-meme-tee-s-black", quantity }], validShippingAddress), ProviderOrderError);
  }
  await assert.rejects(() => adapter.createOrder([{ variantId: "limited-drop-hoodie-l-grey", quantity: 1 }], validShippingAddress), ProviderOrderError);
});

const validShippingAddress = {
  name: "Ellen Ripley",
  address1: "1 Nostromo Way",
  city: "Anchorage",
  countryCode: "US",
  zip: "99501",
};

test("listProducts returns at least one product with at least one variant", async () => {
  const adapter = makeAdapter();
  const products = await adapter.listProducts();
  assert.ok(products.length > 0);
  for (const product of products) {
    assert.ok(product.variants.length > 0, `product ${product.id} has no variants`);
  }
});

test("getProduct returns a matching product for a known id", async () => {
  const adapter = makeAdapter();
  const [first] = await adapter.listProducts();
  const product = await adapter.getProduct(first.id);
  assert.equal(product.id, first.id);
});

test("getProduct throws ProviderNotFoundError for an unknown id", async () => {
  const adapter = makeAdapter();
  await assert.rejects(
    () => adapter.getProduct("does-not-exist"),
    ProviderNotFoundError,
  );
});

test("getVariant returns a matching variant for a known id", async () => {
  const adapter = makeAdapter();
  const [product] = await adapter.listProducts();
  const [variant] = product.variants;
  const result = await adapter.getVariant(variant.id);
  assert.equal(result.id, variant.id);
  assert.equal(result.productId, product.id);
});

test("getVariant throws ProviderNotFoundError for an unknown id", async () => {
  const adapter = makeAdapter();
  await assert.rejects(
    () => adapter.getVariant("does-not-exist"),
    ProviderNotFoundError,
  );
});

test("checkAvailability reflects a variant's availability flag", async () => {
  const adapter = makeAdapter();
  const products = await adapter.listProducts();
  const available = products.flatMap((p) => p.variants).find((v) => v.isAvailable);
  const unavailable = products
    .flatMap((p) => p.variants)
    .find((v) => !v.isAvailable);

  assert.ok(available, "expected at least one available variant in sample data");
  assert.ok(unavailable, "expected at least one unavailable variant in sample data");

  assert.equal(await adapter.checkAvailability(available.id), true);
  assert.equal(await adapter.checkAvailability(unavailable.id), false);
});

test("checkAvailability throws ProviderNotFoundError for an unknown variant", async () => {
  const adapter = makeAdapter();
  await assert.rejects(
    () => adapter.checkAvailability("does-not-exist"),
    ProviderNotFoundError,
  );
});

test("createOrder succeeds for a valid order of available variants", async () => {
  const adapter = makeAdapter();
  const [product] = await adapter.listProducts();
  const [variant] = product.variants;

  const result = await adapter.createOrder(
    [{ variantId: variant.id, quantity: 1 }],
    validShippingAddress,
  );

  assert.ok(result.providerOrderId);
  assert.equal(result.status, "pending");
});

test("createOrder throws ProviderNotFoundError for an unknown variant", async () => {
  const adapter = makeAdapter();
  await assert.rejects(
    () =>
      adapter.createOrder(
        [{ variantId: "does-not-exist", quantity: 1 }],
        validShippingAddress,
      ),
    ProviderNotFoundError,
  );
});

test("createOrder throws ProviderOrderError for an empty line item list", async () => {
  const adapter = makeAdapter();
  await assert.rejects(
    () => adapter.createOrder([], validShippingAddress),
    ProviderOrderError,
  );
});

test("createOrder throws ProviderOrderError for a non-positive quantity", async () => {
  const adapter = makeAdapter();
  const [product] = await adapter.listProducts();
  const [variant] = product.variants;

  await assert.rejects(
    () =>
      adapter.createOrder(
        [{ variantId: variant.id, quantity: 0 }],
        validShippingAddress,
      ),
    ProviderOrderError,
  );
});

test("createOrder throws ProviderOrderError for an incomplete shipping address", async () => {
  const adapter = makeAdapter();
  const [product] = await adapter.listProducts();
  const [variant] = product.variants;

  await assert.rejects(
    () =>
      adapter.createOrder([{ variantId: variant.id, quantity: 1 }], {
        ...validShippingAddress,
        zip: "",
      }),
    ProviderOrderError,
  );
});

test("simulateOrderFailures option forces createOrder to fail", async () => {
  const adapter = new MockPrintProviderAdapter({ simulateOrderFailures: true });
  const [product] = await adapter.listProducts();
  const [variant] = product.variants;

  await assert.rejects(
    () =>
      adapter.createOrder(
        [{ variantId: variant.id, quantity: 1 }],
        validShippingAddress,
      ),
    ProviderOrderError,
  );
});

test("unavailableVariantIds option overrides variant availability", async () => {
  const [product] = await new MockPrintProviderAdapter().listProducts();
  const [variant] = product.variants;
  const adapter = new MockPrintProviderAdapter({
    unavailableVariantIds: [variant.id],
  });

  assert.equal(await adapter.checkAvailability(variant.id), false);
});
