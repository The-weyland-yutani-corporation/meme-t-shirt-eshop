/**
 * Config-file based catalog/content management.
 *
 * Operators update the storefront's catalog/content (categories,
 * tags, products, variants) by editing `catalog.config.json` directly
 * and submitting a pull request. No admin UI, database, or privileged
 * infra/identity/RBAC access is required or exposed (issue #20):
 * operators only ever touch this version-controlled JSON file, and CI
 * validates it the same way `loadCatalogConfig` does here.
 *
 * `loadCatalogConfig` / `validateCatalogConfig` check the parsed JSON
 * against the catalog domain model in `../types.ts`: required
 * fields/types, duplicate ids, cross-references (category
 * `parentId`, product `categoryId`/`tagIds`, variant `productId`),
 * non-empty variants, and variant `priceCents` integrity. Invalid
 * content fails fast with a descriptive `CatalogConfigError` so bad
 * config is caught in CI/code review rather than at runtime.
 */

import type { Category, Product, Tag } from "../types.ts";

/** The validated shape of `catalog.config.json`. */
export interface CatalogConfig {
  categories: Category[];
  tags: Tag[];
  products: Product[];
}

/** Raised when catalog content fails validation. */
export class CatalogConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CatalogConfigError";
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString);
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new CatalogConfigError(message);
  }
}

function validateCategories(raw: unknown): Category[] {
  assert(Array.isArray(raw), "categories must be an array");
  const categories = raw as unknown[];
  const seenIds = new Set<string>();

  return categories.map((entry, index) => {
    assert(
      typeof entry === "object" && entry !== null,
      `categories[${index}] must be an object`,
    );
    const category = entry as Record<string, unknown>;
    assert(
      isNonEmptyString(category.id),
      `categories[${index}].id must be a non-empty string`,
    );
    assert(
      !seenIds.has(category.id as string),
      `duplicate category id: ${category.id as string}`,
    );
    seenIds.add(category.id as string);
    assert(
      isNonEmptyString(category.name),
      `categories[${index}].name must be a non-empty string`,
    );
    if (category.description !== undefined) {
      assert(
        isString(category.description),
        `categories[${index}].description must be a string`,
      );
    }
    if (category.parentId !== undefined) {
      assert(
        isNonEmptyString(category.parentId),
        `categories[${index}].parentId must be a non-empty string`,
      );
    }
    return category as unknown as Category;
  });
}

function validateTags(raw: unknown): Tag[] {
  assert(Array.isArray(raw), "tags must be an array");
  const tags = raw as unknown[];
  const seenIds = new Set<string>();

  return tags.map((entry, index) => {
    assert(
      typeof entry === "object" && entry !== null,
      `tags[${index}] must be an object`,
    );
    const tag = entry as Record<string, unknown>;
    assert(
      isNonEmptyString(tag.id),
      `tags[${index}].id must be a non-empty string`,
    );
    assert(!seenIds.has(tag.id as string), `duplicate tag id: ${tag.id as string}`);
    seenIds.add(tag.id as string);
    assert(
      isNonEmptyString(tag.label),
      `tags[${index}].label must be a non-empty string`,
    );
    return tag as unknown as Tag;
  });
}

function validateVariant(
  raw: unknown,
  productId: string,
  productIndex: number,
  variantIndex: number,
  seenVariantIds: Set<string>,
): void {
  assert(
    typeof raw === "object" && raw !== null,
    `products[${productIndex}].variants[${variantIndex}] must be an object`,
  );
  const variant = raw as Record<string, unknown>;
  const where = `products[${productIndex}].variants[${variantIndex}]`;

  assert(isNonEmptyString(variant.id), `${where}.id must be a non-empty string`);
  assert(
    !seenVariantIds.has(variant.id as string),
    `duplicate variant id: ${variant.id as string}`,
  );
  seenVariantIds.add(variant.id as string);

  assert(
    isNonEmptyString(variant.productId),
    `${where}.productId must be a non-empty string`,
  );
  assert(
    variant.productId === productId,
    `${where}.productId ("${variant.productId as string}") must match parent product id ("${productId}")`,
  );

  assert(isNonEmptyString(variant.name), `${where}.name must be a non-empty string`);
  if (variant.size !== undefined) {
    assert(isString(variant.size), `${where}.size must be a string`);
  }
  if (variant.color !== undefined) {
    assert(isString(variant.color), `${where}.color must be a string`);
  }
  assert(
    typeof variant.priceCents === "number" &&
      Number.isInteger(variant.priceCents) &&
      variant.priceCents >= 0,
    `${where}.priceCents must be a non-negative integer`,
  );
  assert(
    isNonEmptyString(variant.currency),
    `${where}.currency must be a non-empty string`,
  );
  assert(
    isNonEmptyString(variant.providerVariantId),
    `${where}.providerVariantId must be a non-empty string`,
  );
  assert(
    typeof variant.isAvailable === "boolean",
    `${where}.isAvailable must be a boolean`,
  );
}

function validateProducts(
  raw: unknown,
  categoryIds: Set<string>,
  tagIds: Set<string>,
): Product[] {
  assert(Array.isArray(raw), "products must be an array");
  const products = raw as unknown[];
  const seenProductIds = new Set<string>();
  const seenVariantIds = new Set<string>();

  return products.map((entry, index) => {
    assert(
      typeof entry === "object" && entry !== null,
      `products[${index}] must be an object`,
    );
    const product = entry as Record<string, unknown>;
    const where = `products[${index}]`;

    assert(isNonEmptyString(product.id), `${where}.id must be a non-empty string`);
    assert(
      !seenProductIds.has(product.id as string),
      `duplicate product id: ${product.id as string}`,
    );
    seenProductIds.add(product.id as string);

    assert(isNonEmptyString(product.name), `${where}.name must be a non-empty string`);
    assert(
      isNonEmptyString(product.description),
      `${where}.description must be a non-empty string`,
    );

    assert(
      isNonEmptyString(product.categoryId),
      `${where}.categoryId must be a non-empty string`,
    );
    assert(
      categoryIds.has(product.categoryId as string),
      `${where}.categoryId references unknown category: ${product.categoryId as string}`,
    );

    assert(isStringArray(product.tagIds), `${where}.tagIds must be an array of strings`);
    for (const tagId of product.tagIds as string[]) {
      assert(tagIds.has(tagId), `${where}.tagIds references unknown tag: ${tagId}`);
    }

    assert(isStringArray(product.images), `${where}.images must be an array of strings`);

    assert(
      Array.isArray(product.variants) && product.variants.length > 0,
      `${where}.variants must be a non-empty array`,
    );
    for (const [variantIndex, variant] of (product.variants as unknown[]).entries()) {
      validateVariant(
        variant,
        product.id as string,
        index,
        variantIndex,
        seenVariantIds,
      );
    }

    return product as unknown as Product;
  });
}

function validateCategoryParents(categories: Category[]): void {
  const categoryIds = new Set(categories.map((category) => category.id));
  for (const category of categories) {
    if (category.parentId !== undefined) {
      assert(
        categoryIds.has(category.parentId),
        `category "${category.id}" has unknown parentId: ${category.parentId}`,
      );
    }
  }
}

/**
 * Validates a parsed catalog config object against the catalog domain
 * model, throwing `CatalogConfigError` with a descriptive message on
 * the first problem found.
 */
export function validateCatalogConfig(raw: unknown): CatalogConfig {
  assert(
    typeof raw === "object" && raw !== null,
    "catalog config must be a JSON object",
  );
  const config = raw as Record<string, unknown>;

  const categories = validateCategories(config.categories);
  validateCategoryParents(categories);

  const tags = validateTags(config.tags);

  const categoryIds = new Set(categories.map((category) => category.id));
  const tagIds = new Set(tags.map((tag) => tag.id));
  const products = validateProducts(config.products, categoryIds, tagIds);

  return { categories, tags, products };
}

/**
 * Loads and validates `catalog.config.json`, the operator-editable
 * source of truth for catalog/content. Throws `CatalogConfigError` if
 * the file is missing, isn't valid JSON, or fails domain validation.
 */
export async function loadCatalogConfig(
  configPath: string = new URL("./catalog.config.json", import.meta.url).pathname,
): Promise<CatalogConfig> {
  const { readFile } = await import("node:fs/promises");
  let text: string;
  try {
    text = await readFile(configPath, "utf-8");
  } catch (error) {
    throw new CatalogConfigError(
      `failed to read catalog config at ${configPath}: ${(error as Error).message}`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new CatalogConfigError(
      `catalog config at ${configPath} is not valid JSON: ${(error as Error).message}`,
    );
  }

  return validateCatalogConfig(parsed);
}
