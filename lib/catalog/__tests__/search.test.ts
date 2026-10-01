/**
 * Tests for catalog search/filter/pagination helpers.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  filterAndPaginateProducts,
  isProductInStock,
  listCategoryIds,
  lowestPricedVariant,
} from "../search.ts";
import type { Product } from "../types.ts";

function makeProduct(overrides: Partial<Product> & { id: string }): Product {
  return {
    name: overrides.name ?? overrides.id,
    description: overrides.description ?? "",
    categoryId: overrides.categoryId ?? "t-shirts",
    tagIds: overrides.tagIds ?? [],
    images: overrides.images ?? [],
    variants: overrides.variants ?? [
      {
        id: `${overrides.id}-v1`,
        productId: overrides.id,
        name: "Default",
        priceCents: 1000,
        currency: "USD",
        providerVariantId: "pf-1",
        isAvailable: true,
      },
    ],
    ...overrides,
  };
}

const sampleProducts: Product[] = [
  makeProduct({
    id: "classic-tee",
    name: "Classic Meme Tee",
    description: "A soft classic tee",
    categoryId: "t-shirts",
    tagIds: ["bestseller"],
  }),
  makeProduct({
    id: "limited-hoodie",
    name: "Limited Drop Hoodie",
    description: "Heavyweight hoodie",
    categoryId: "hoodies",
    tagIds: ["limited-edition"],
    variants: [
      {
        id: "limited-hoodie-v1",
        productId: "limited-hoodie",
        name: "Grey / L",
        priceCents: 5499,
        currency: "USD",
        providerVariantId: "pf-2",
        isAvailable: false,
      },
    ],
  }),
  makeProduct({
    id: "retro-cap",
    name: "Retro Cap",
    description: "A classic cap",
    categoryId: "accessories",
    tagIds: [],
  }),
];

test("filterAndPaginateProducts returns all products with no filters", () => {
  const result = filterAndPaginateProducts(sampleProducts);
  assert.equal(result.total, 3);
  assert.equal(result.items.length, 3);
  assert.equal(result.page, 1);
  assert.equal(result.totalPages, 1);
});

test("filterAndPaginateProducts filters by free-text search across name/description", () => {
  const result = filterAndPaginateProducts(sampleProducts, { query: "classic" });
  assert.equal(result.total, 2);
  assert.ok(result.items.some((p) => p.id === "classic-tee"));
  assert.ok(result.items.some((p) => p.id === "retro-cap"));
});

test("filterAndPaginateProducts filters by categoryId", () => {
  const result = filterAndPaginateProducts(sampleProducts, { categoryId: "hoodies" });
  assert.equal(result.total, 1);
  assert.equal(result.items[0].id, "limited-hoodie");
});

test("filterAndPaginateProducts filters by tagId", () => {
  const result = filterAndPaginateProducts(sampleProducts, { tagId: "bestseller" });
  assert.equal(result.total, 1);
  assert.equal(result.items[0].id, "classic-tee");
});

test("filterAndPaginateProducts paginates and clamps page number", () => {
  const page1 = filterAndPaginateProducts(sampleProducts, { pageSize: 2, page: 1 });
  assert.equal(page1.items.length, 2);
  assert.equal(page1.totalPages, 2);

  const page2 = filterAndPaginateProducts(sampleProducts, { pageSize: 2, page: 2 });
  assert.equal(page2.items.length, 1);

  const overPage = filterAndPaginateProducts(sampleProducts, { pageSize: 2, page: 99 });
  assert.equal(overPage.page, 2);

  const underPage = filterAndPaginateProducts(sampleProducts, { pageSize: 2, page: 0 });
  assert.equal(underPage.page, 1);
});

test("listCategoryIds returns unique categories in first-seen order", () => {
  assert.deepEqual(listCategoryIds(sampleProducts), ["t-shirts", "hoodies", "accessories"]);
});

test("isProductInStock reflects variant availability", () => {
  assert.equal(isProductInStock(sampleProducts[0]), true);
  assert.equal(isProductInStock(sampleProducts[1]), false);
});

test("lowestPricedVariant returns the cheapest variant", () => {
  const product = makeProduct({
    id: "multi",
    variants: [
      {
        id: "multi-expensive",
        productId: "multi",
        name: "Expensive",
        priceCents: 3000,
        currency: "USD",
        providerVariantId: "pf-a",
        isAvailable: true,
      },
      {
        id: "multi-cheap",
        productId: "multi",
        name: "Cheap",
        priceCents: 1500,
        currency: "USD",
        providerVariantId: "pf-b",
        isAvailable: true,
      },
    ],
  });
  assert.equal(lowestPricedVariant(product)?.id, "multi-cheap");
});
