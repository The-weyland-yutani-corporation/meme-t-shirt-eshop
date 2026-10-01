/**
 * Tests for the config-file catalog/content operator workflow.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  CatalogConfigError,
  loadCatalogConfig,
  validateCatalogConfig,
} from "../catalog-config.ts";

import type { CatalogConfig } from "../catalog-config.ts";

function validPayload(): CatalogConfig {
  return {
    categories: [{ id: "t-shirts", name: "T-Shirts" }],
    tags: [{ id: "bestseller", label: "Bestseller" }],
    products: [
      {
        id: "classic-meme-tee",
        name: "Classic Meme Tee",
        description: "A soft-cotton unisex tee.",
        categoryId: "t-shirts",
        tagIds: ["bestseller"],
        images: ["/images/tee.png"],
        variants: [
          {
            id: "classic-meme-tee-s",
            productId: "classic-meme-tee",
            name: "S",
            priceCents: 1999,
            currency: "USD",
            providerVariantId: "pf-1",
            isAvailable: true,
          },
        ],
      },
    ],
  };
}

test("loadCatalogConfig loads and validates the real repo catalog.config.json", () => {
  const config = loadCatalogConfig();
  assert.ok(config.categories.length > 0);
  assert.ok(config.tags.length > 0);
  assert.ok(config.products.length > 0);
  for (const product of config.products) {
    assert.ok(product.variants.length > 0, `product ${product.id} has no variants`);
  }
});

test("validateCatalogConfig accepts a well-formed payload", () => {
  const config = validateCatalogConfig(validPayload());
  assert.equal(config.products.length, 1);
  assert.equal(config.products[0].variants[0].id, "classic-meme-tee-s");
});

test("validateCatalogConfig rejects a non-object payload", () => {
  assert.throws(() => validateCatalogConfig(null), CatalogConfigError);
  assert.throws(() => validateCatalogConfig("nope"), CatalogConfigError);
});

test("validateCatalogConfig rejects a product referencing an unknown category", () => {
  const payload = validPayload();
  payload.products[0].categoryId = "does-not-exist";
  assert.throws(
    () => validateCatalogConfig(payload),
    /unknown categoryId/,
  );
});

test("validateCatalogConfig rejects a product referencing an unknown tag", () => {
  const payload = validPayload();
  payload.products[0].tagIds = ["does-not-exist"];
  assert.throws(() => validateCatalogConfig(payload), /unknown tag id/);
});

test("validateCatalogConfig rejects a product with no variants", () => {
  const payload = validPayload();
  payload.products[0].variants = [];
  assert.throws(() => validateCatalogConfig(payload), /non-empty array/);
});

test("validateCatalogConfig rejects a variant with a mismatched productId", () => {
  const payload = validPayload();
  payload.products[0].variants[0].productId = "some-other-product";
  assert.throws(() => validateCatalogConfig(payload), /belongs to product/);
});

test("validateCatalogConfig rejects a negative or non-integer priceCents", () => {
  const negative = validPayload();
  negative.products[0].variants[0].priceCents = -1;
  assert.throws(() => validateCatalogConfig(negative), CatalogConfigError);

  const fractional = validPayload();
  fractional.products[0].variants[0].priceCents = 19.99;
  assert.throws(() => validateCatalogConfig(fractional), CatalogConfigError);
});

test("validateCatalogConfig rejects duplicate category ids", () => {
  const payload = validPayload();
  payload.categories.push({ id: "t-shirts", name: "T-Shirts Again" });
  assert.throws(() => validateCatalogConfig(payload), /duplicate category id/);
});

test("validateCatalogConfig rejects duplicate product ids", () => {
  const payload = validPayload();
  payload.products.push({ ...payload.products[0] });
  assert.throws(() => validateCatalogConfig(payload), /duplicate product id/);
});

test("validateCatalogConfig rejects a category with an unknown parentId", () => {
  const payload = validPayload();
  payload.categories[0] = {
    ...payload.categories[0],
    parentId: "missing-parent",
  };
  assert.throws(() => validateCatalogConfig(payload), /unknown parentId/);
});

test("loadCatalogConfig throws CatalogConfigError for invalid JSON", (t: unknown) => {
  const testContext = t as { after: (fn: () => void) => void };
  const path = join(tmpdir(), `catalog-config-invalid-json-${process.pid}.json`);
  writeFileSync(path, "{ not valid json", "utf-8");
  testContext.after(() => unlinkSync(path));
  assert.throws(() => loadCatalogConfig(path), CatalogConfigError);
});
