/**
 * Config-file catalog/content operator workflow.
 *
 * Scope: lets operators (e.g. the Storefront Engineer, or any
 * contributor) update the storefront's catalog/content — categories,
 * tags, products, and variants — by editing a single JSON config
 * file (`./catalog.config.json`) and submitting it through a normal
 * pull request review. This intentionally avoids any admin UI,
 * database, or privileged infra/identity access: the only surface
 * operators touch is version-controlled content data, reviewed like
 * any other code change.
 *
 * `loadCatalogConfig` validates the config's shape against the
 * catalog domain model (`../types.ts`) so malformed content is
 * rejected with a clear error at build/test time rather than causing
 * confusing failures downstream in the storefront or checkout flow.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import type { Category, Product, ProductVariant, Tag } from "../types.ts";

/** The full operator-editable catalog/content payload. */
export interface CatalogConfig {
  categories: Category[];
  tags: Tag[];
  products: Product[];
}

/** Raised when a catalog config file fails validation. */
export class CatalogConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CatalogConfigError";
  }
}

const DEFAULT_CONFIG_URL = new URL("./catalog.config.json", import.meta.url);

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new CatalogConfigError(message);
  }
}

function validateCategory(value: unknown, index: number): Category {
  assert(
    typeof value === "object" && value !== null,
    `categories[${index}] must be an object`,
  );
  const category = value as Record<string, unknown>;
  assert(
    isNonEmptyString(category.id),
    `categories[${index}].id must be a non-empty string`,
  );
  assert(
    isNonEmptyString(category.name),
    `categories[${index}].name must be a non-empty string`,
  );
  assert(
    category.description === undefined ||
      typeof category.description === "string",
    `categories[${index}].description must be a string if present`,
  );
  assert(
    category.parentId === undefined || typeof category.parentId === "string",
    `categories[${index}].parentId must be a string if present`,
  );
  return {
    id: category.id as string,
    name: category.name as string,
    ...(category.description !== undefined
      ? { description: category.description as string }
      : {}),
    ...(category.parentId !== undefined
      ? { parentId: category.parentId as string }
      : {}),
  };
}

function validateTag(value: unknown, index: number): Tag {
  assert(
    typeof value === "object" && value !== null,
    `tags[${index}] must be an object`,
  );
  const tag = value as Record<string, unknown>;
  assert(isNonEmptyString(tag.id), `tags[${index}].id must be a non-empty string`);
  assert(
    isNonEmptyString(tag.label),
    `tags[${index}].label must be a non-empty string`,
  );
  return { id: tag.id as string, label: tag.label as string };
}

function validateVariant(
  value: unknown,
  productIndex: number,
  variantIndex: number,
): ProductVariant {
  const path = `products[${productIndex}].variants[${variantIndex}]`;
  assert(typeof value === "object" && value !== null, `${path} must be an object`);
  const variant = value as Record<string, unknown>;
  assert(isNonEmptyString(variant.id), `${path}.id must be a non-empty string`);
  assert(
    isNonEmptyString(variant.productId),
    `${path}.productId must be a non-empty string`,
  );
  assert(isNonEmptyString(variant.name), `${path}.name must be a non-empty string`);
  assert(
    variant.size === undefined || typeof variant.size === "string",
    `${path}.size must be a string if present`,
  );
  assert(
    variant.color === undefined || typeof variant.color === "string",
    `${path}.color must be a string if present`,
  );
  assert(
    typeof variant.priceCents === "number" &&
      Number.isInteger(variant.priceCents) &&
      variant.priceCents >= 0,
    `${path}.priceCents must be a non-negative integer`,
  );
  assert(
    isNonEmptyString(variant.currency),
    `${path}.currency must be a non-empty string`,
  );
  assert(
    isNonEmptyString(variant.providerVariantId),
    `${path}.providerVariantId must be a non-empty string`,
  );
  assert(
    typeof variant.isAvailable === "boolean",
    `${path}.isAvailable must be a boolean`,
  );
  return {
    id: variant.id as string,
    productId: variant.productId as string,
    name: variant.name as string,
    ...(variant.size !== undefined ? { size: variant.size as string } : {}),
    ...(variant.color !== undefined ? { color: variant.color as string } : {}),
    priceCents: variant.priceCents as number,
    currency: variant.currency as string,
    providerVariantId: variant.providerVariantId as string,
    isAvailable: variant.isAvailable as boolean,
  };
}

function validateProduct(value: unknown, index: number): Product {
  assert(
    typeof value === "object" && value !== null,
    `products[${index}] must be an object`,
  );
  const product = value as Record<string, unknown>;
  assert(
    isNonEmptyString(product.id),
    `products[${index}].id must be a non-empty string`,
  );
  assert(
    isNonEmptyString(product.name),
    `products[${index}].name must be a non-empty string`,
  );
  assert(
    isNonEmptyString(product.description),
    `products[${index}].description must be a non-empty string`,
  );
  assert(
    isNonEmptyString(product.categoryId),
    `products[${index}].categoryId must be a non-empty string`,
  );
  assert(
    Array.isArray(product.tagIds) &&
      product.tagIds.every((tagId) => typeof tagId === "string"),
    `products[${index}].tagIds must be an array of strings`,
  );
  assert(
    Array.isArray(product.images) &&
      product.images.every((image) => typeof image === "string"),
    `products[${index}].images must be an array of strings`,
  );
  assert(
    Array.isArray(product.variants) && product.variants.length > 0,
    `products[${index}].variants must be a non-empty array`,
  );
  const variants = (product.variants as unknown[]).map((variant, variantIndex) =>
    validateVariant(variant, index, variantIndex),
  );
  for (const variant of variants) {
    assert(
      variant.productId === product.id,
      `products[${index}].variants: variant "${variant.id}" has productId ` +
        `"${variant.productId}" but belongs to product "${product.id}"`,
    );
  }
  return {
    id: product.id as string,
    name: product.name as string,
    description: product.description as string,
    categoryId: product.categoryId as string,
    tagIds: product.tagIds as string[],
    images: product.images as string[],
    variants,
  };
}

/**
 * Validate an already-parsed catalog config payload against the
 * catalog domain model, including cross-references between products,
 * categories, and tags. Throws `CatalogConfigError` describing the
 * first problem found.
 */
export function validateCatalogConfig(data: unknown): CatalogConfig {
  assert(
    typeof data === "object" && data !== null,
    "catalog config must be a JSON object",
  );
  const root = data as Record<string, unknown>;
  assert(Array.isArray(root.categories), "catalog config.categories must be an array");
  assert(Array.isArray(root.tags), "catalog config.tags must be an array");
  assert(Array.isArray(root.products), "catalog config.products must be an array");

  const categories = root.categories.map((category, index) =>
    validateCategory(category, index),
  );
  const tags = root.tags.map((tag, index) => validateTag(tag, index));
  const products = root.products.map((product, index) =>
    validateProduct(product, index),
  );

  const categoryIds = new Set(categories.map((category) => category.id));
  const tagIds = new Set(tags.map((tag) => tag.id));

  const seenCategoryIds = new Set<string>();
  for (const category of categories) {
    assert(
      !seenCategoryIds.has(category.id),
      `duplicate category id: "${category.id}"`,
    );
    seenCategoryIds.add(category.id);
    if (category.parentId !== undefined) {
      assert(
        categoryIds.has(category.parentId),
        `category "${category.id}" has unknown parentId "${category.parentId}"`,
      );
    }
  }

  const seenTagIds = new Set<string>();
  for (const tag of tags) {
    assert(!seenTagIds.has(tag.id), `duplicate tag id: "${tag.id}"`);
    seenTagIds.add(tag.id);
  }

  const seenProductIds = new Set<string>();
  for (const product of products) {
    assert(!seenProductIds.has(product.id), `duplicate product id: "${product.id}"`);
    seenProductIds.add(product.id);
    assert(
      categoryIds.has(product.categoryId),
      `product "${product.id}" has unknown categoryId "${product.categoryId}"`,
    );
    for (const tagId of product.tagIds) {
      assert(
        tagIds.has(tagId),
        `product "${product.id}" references unknown tag id "${tagId}"`,
      );
    }
  }

  return { categories, tags, products };
}

/**
 * Load and validate the catalog config file. Defaults to the
 * version-controlled `./catalog.config.json` operators edit via pull
 * request, but accepts a `configPath` override for tests or alternate
 * content sources.
 */
export function loadCatalogConfig(configPath?: string | URL): CatalogConfig {
  const url = configPath ?? DEFAULT_CONFIG_URL;
  const path = typeof url === "string" ? url : fileURLToPath(url);
  const raw = readFileSync(path, "utf-8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new CatalogConfigError(`catalog config is not valid JSON: ${message}`);
  }
  return validateCatalogConfig(parsed);
}
