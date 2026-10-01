/**
 * Contract tests for `PrintfulAdapter` against a fake, in-memory
 * `fetch` implementation that mimics the Printful v1 REST API.
 *
 * These tests verify `PrintfulAdapter` satisfies the same
 * `PrintProviderAdapter` contract as `MockPrintProviderAdapter`
 * (see `provider-adapter.contract.test.ts`), plus Printful-specific
 * behavior: bounded/observable retries and fulfillment status
 * mapping, all without any live network calls or credentials.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { ProviderNotFoundError, ProviderOrderError } from "../types.ts";
import {
  PrintfulAdapter,
  mapWebhookEventToOrderResult,
} from "../printful-adapter.ts";
import type { FetchLike } from "../printful-adapter.ts";

const validShippingAddress = {
  name: "Ellen Ripley",
  address1: "1 Nostromo Way",
  city: "Anchorage",
  countryCode: "US",
  zip: "99501",
};

interface FakeResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

function jsonResponse(status: number, body: unknown): FakeResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

/** Builds a fake fetch backed by an in-memory Printful-like store. */
function makeFakeFetch(options: {
  failuresBeforeSuccess?: number;
  failureStatus?: number;
  alwaysFail?: boolean;
} = {}): { fetchImpl: FetchLike; calls: string[] } {
  const calls: string[] = [];
  let remainingFailures = options.failuresBeforeSuccess ?? 0;
  const failureStatus = options.failureStatus ?? 503;

  const syncVariant = {
    id: 1001,
    variant_id: 9001,
    name: "Black / M",
    retail_price: "24.99",
    currency: "USD",
    size: "M",
    color: "Black",
    availability_status: "active",
  };
  const syncProduct = {
    id: 501,
    name: "Classic Meme Tee",
    thumbnail_url: "https://example.test/img.png",
    sync_variants: [syncVariant],
  };

  const fetchImpl: FetchLike = async (url, init) => {
    calls.push(`${init?.method ?? "GET"} ${url}`);

    if (options.alwaysFail || remainingFailures > 0) {
      if (remainingFailures > 0) remainingFailures -= 1;
      return jsonResponse(failureStatus, { error: "transient" });
    }

    if (url.endsWith("/store/products") && init?.method !== "POST") {
      return jsonResponse(200, { result: [syncProduct] });
    }
    if (url.endsWith(`/store/products/${syncProduct.id}`)) {
      return jsonResponse(200, {
        result: { sync_product: syncProduct, sync_variants: [syncVariant] },
      });
    }
    if (url.endsWith(`/store/variants/${syncVariant.id}`)) {
      return jsonResponse(200, { result: { sync_variant: syncVariant } });
    }
    if (url.endsWith("/store/variants/does-not-exist")) {
      return jsonResponse(404, { error: "not found" });
    }
    if (url.endsWith("/store/products/does-not-exist")) {
      return jsonResponse(404, { error: "not found" });
    }
    if (url.endsWith("/orders") && init?.method === "POST") {
      return jsonResponse(200, { result: { id: 777, status: "pending" } });
    }
    if (url.endsWith("/orders/777")) {
      return jsonResponse(200, { result: { id: 777, status: "fulfilled" } });
    }

    return jsonResponse(404, { error: "unhandled route in fake fetch" });
  };

  return { fetchImpl, calls };
}

function makeAdapter(fetchImpl: FetchLike, overrides: Partial<{ maxRetries: number; retryDelayMsBase: number }> = {}) {
  return new PrintfulAdapter({
    apiKey: "test-key",
    fetchImpl,
    retryDelayMsBase: 1,
    ...overrides,
  });
}

test("listProducts returns products mapped from the Printful catalog", async () => {
  const { fetchImpl } = makeFakeFetch();
  const adapter = makeAdapter(fetchImpl);
  const products = await adapter.listProducts();
  assert.equal(products.length, 1);
  assert.equal(products[0].variants.length, 1);
  assert.equal(products[0].variants[0].priceCents, 2499);
});

test("getProduct returns a matching product for a known id", async () => {
  const { fetchImpl } = makeFakeFetch();
  const adapter = makeAdapter(fetchImpl);
  const product = await adapter.getProduct("501");
  assert.equal(product.id, "501");
  assert.equal(product.variants[0].currency, "USD");
});

test("getProduct throws ProviderNotFoundError for an unknown id", async () => {
  const { fetchImpl } = makeFakeFetch();
  const adapter = makeAdapter(fetchImpl);
  await assert.rejects(
    () => adapter.getProduct("does-not-exist"),
    ProviderNotFoundError,
  );
});

test("getVariant returns a matching variant for a known id", async () => {
  const { fetchImpl } = makeFakeFetch();
  const adapter = makeAdapter(fetchImpl);
  const variant = await adapter.getVariant("1001");
  assert.equal(variant.id, "1001");
  assert.equal(variant.isAvailable, true);
});

test("getVariant throws ProviderNotFoundError for an unknown variant", async () => {
  const { fetchImpl } = makeFakeFetch();
  const adapter = makeAdapter(fetchImpl);
  await assert.rejects(
    () => adapter.getVariant("does-not-exist"),
    ProviderNotFoundError,
  );
});

test("checkAvailability reflects variant availability status", async () => {
  const { fetchImpl } = makeFakeFetch();
  const adapter = makeAdapter(fetchImpl);
  assert.equal(await adapter.checkAvailability("1001"), true);
});

test("createOrder succeeds and returns a customer-safe pending status", async () => {
  const { fetchImpl } = makeFakeFetch();
  const adapter = makeAdapter(fetchImpl);
  const result = await adapter.createOrder(
    [{ variantId: "1001", quantity: 1 }],
    validShippingAddress,
  );
  assert.equal(result.providerOrderId, "777");
  assert.equal(result.status, "pending");
});

test("createOrder throws ProviderOrderError for an empty line item list", async () => {
  const { fetchImpl } = makeFakeFetch();
  const adapter = makeAdapter(fetchImpl);
  await assert.rejects(
    () => adapter.createOrder([], validShippingAddress),
    ProviderOrderError,
  );
});

test("createOrder throws ProviderOrderError for a non-positive quantity", async () => {
  const { fetchImpl } = makeFakeFetch();
  const adapter = makeAdapter(fetchImpl);
  await assert.rejects(
    () =>
      adapter.createOrder(
        [{ variantId: "1001", quantity: 0 }],
        validShippingAddress,
      ),
    ProviderOrderError,
  );
});

test("createOrder throws ProviderOrderError for an incomplete shipping address", async () => {
  const { fetchImpl } = makeFakeFetch();
  const adapter = makeAdapter(fetchImpl);
  await assert.rejects(
    () =>
      adapter.createOrder([{ variantId: "1001", quantity: 1 }], {
        ...validShippingAddress,
        zip: "",
      }),
    ProviderOrderError,
  );
});

test("getOrderStatus maps Printful fulfilled status for polling", async () => {
  const { fetchImpl } = makeFakeFetch();
  const adapter = makeAdapter(fetchImpl);
  const result = await adapter.getOrderStatus("777");
  assert.equal(result.status, "fulfilled");
});

test("retries bounded number of times on transient failures and then succeeds", async () => {
  const { fetchImpl, calls } = makeFakeFetch({ failuresBeforeSuccess: 2, failureStatus: 503 });
  const adapter = makeAdapter(fetchImpl, { maxRetries: 3 });
  const variant = await adapter.getVariant("1001");
  assert.equal(variant.id, "1001");
  // 2 failed attempts + 1 successful attempt, all observable via fetch calls.
  assert.equal(calls.length, 3);
});

test("retries are bounded and surface a customer-safe error when exhausted", async () => {
  const { fetchImpl, calls } = makeFakeFetch({ alwaysFail: true, failureStatus: 500 });
  const adapter = makeAdapter(fetchImpl, { maxRetries: 2 });
  await assert.rejects(() => adapter.getVariant("1001"), ProviderOrderError);
  // Initial attempt + 2 retries = 3 calls, never unbounded.
  assert.equal(calls.length, 3);
});

test("non-transient 404s are not retried", async () => {
  const { fetchImpl, calls } = makeFakeFetch();
  const adapter = makeAdapter(fetchImpl, { maxRetries: 3 });
  await assert.rejects(() => adapter.getVariant("does-not-exist"), ProviderNotFoundError);
  assert.equal(calls.length, 1);
});

test("mapWebhookEventToOrderResult surfaces customer-safe status from a webhook payload", () => {
  const result = mapWebhookEventToOrderResult({
    type: "package_shipped",
    data: { order: { id: 777, status: "fulfilled" } },
  });
  assert.deepEqual(result, { providerOrderId: "777", status: "fulfilled" });
});

test("mapWebhookEventToOrderResult returns undefined for unrelated events", () => {
  const result = mapWebhookEventToOrderResult({
    type: "noop",
    data: undefined as unknown as { order: { id: number; status: string } },
  });
  assert.equal(result, undefined);
});
