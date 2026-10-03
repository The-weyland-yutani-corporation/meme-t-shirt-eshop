import assert from "node:assert/strict";
import { test } from "node:test";

import {
  CatalogConfigError,
  loadCatalogConfig,
  validateCatalogConfig,
} from "../catalog-config.ts";

function validConfig() {
  return {
    categories: [
      { id: "t-shirts", name: "T-Shirts" },
      { id: "hoodies", name: "Hoodies", parentId: "t-shirts" },
    ],
    tags: [{ id: "bestseller", label: "Bestseller" }],
    products: [
      {
        id: "classic-meme-tee",
        name: "Classic Meme Tee",
        description: "A soft-cotton unisex tee.",
        categoryId: "t-shirts",
        tagIds: ["bestseller"],
        images: ["/images/classic-meme-tee-front.png"],
        variants: [
          {
            id: "classic-meme-tee-s-black",
            productId: "classic-meme-tee",
            name: "Black / S",
            size: "S",
            color: "Black",
            priceCents: 2499,
            currency: "USD",
            providerVariantId: "pf-1001",
            isAvailable: true,
          },
        ],
      },
    ],
  };
}

test("validateCatalogConfig accepts a well-formed config", () => {
  const config = validateCatalogConfig(validConfig());
  assert.equal(config.categories.length, 2);
  assert.equal(config.tags.length, 1);
  assert.equal(config.products.length, 1);
  assert.equal(config.products[0].variants.length, 1);
});

test("loadCatalogConfig reads and validates the on-disk config", async () => {
  const config = await loadCatalogConfig();
  assert.ok(config.categories.length > 0);
  assert.ok(config.products.length > 0);
  for (const product of config.products) {
    assert.ok(config.categories.some((c) => c.id === product.categoryId));
    for (const tagId of product.tagIds) {
      assert.ok(config.tags.some((t) => t.id === tagId));
    }
    assert.ok(product.variants.length > 0);
  }
});

test("loadCatalogConfig throws CatalogConfigError for a missing file", async () => {
  await assert.rejects(
    () => loadCatalogConfig("/nonexistent/catalog.config.json"),
    CatalogConfigError,
  );
});

test("rejects non-object config", () => {
  assert.throws(() => validateCatalogConfig(null), CatalogConfigError);
  assert.throws(() => validateCatalogConfig("not an object"), CatalogConfigError);
});

test("rejects duplicate category id", () => {
  const config = validConfig();
  config.categories.push({ id: "t-shirts", name: "Duplicate" });
  assert.throws(() => validateCatalogConfig(config), /duplicate category id/);
});

test("rejects category with unknown parentId", () => {
  const config = validConfig();
  config.categories[1].parentId = "does-not-exist";
  assert.throws(() => validateCatalogConfig(config), /unknown parentId/);
});

test("rejects duplicate tag id", () => {
  const config = validConfig();
  config.tags.push({ id: "bestseller", label: "Duplicate" });
  assert.throws(() => validateCatalogConfig(config), /duplicate tag id/);
});

test("rejects duplicate product id", () => {
  const config = validConfig();
  config.products.push({ ...config.products[0] });
  assert.throws(() => validateCatalogConfig(config), /duplicate product id/);
});

test("rejects product with unknown categoryId", () => {
  const config = validConfig();
  config.products[0].categoryId = "does-not-exist";
  assert.throws(() => validateCatalogConfig(config), /unknown category/);
});

test("rejects product with unknown tagIds entry", () => {
  const config = validConfig();
  config.products[0].tagIds = ["does-not-exist"];
  assert.throws(() => validateCatalogConfig(config), /unknown tag/);
});

test("rejects product with empty variants", () => {
  const config = validConfig();
  config.products[0].variants = [];
  assert.throws(() => validateCatalogConfig(config), /non-empty array/);
});

test("rejects variant with mismatched productId", () => {
  const config = validConfig();
  config.products[0].variants[0].productId = "other-product";
  assert.throws(() => validateCatalogConfig(config), /must match parent product id/);
});

test("rejects duplicate variant id", () => {
  const config = validConfig();
  config.products[0].variants.push({ ...config.products[0].variants[0] });
  assert.throws(() => validateCatalogConfig(config), /duplicate variant id/);
});

test("rejects variant with non-integer priceCents", () => {
  const config = validConfig();
  config.products[0].variants[0].priceCents = 24.99;
  assert.throws(() => validateCatalogConfig(config), /non-negative integer/);
});

test("rejects variant with negative priceCents", () => {
  const config = validConfig();
  config.products[0].variants[0].priceCents = -100;
  assert.throws(() => validateCatalogConfig(config), /non-negative integer/);
});
