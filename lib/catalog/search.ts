/**
 * Pure catalog search/filter/pagination helpers.
 *
 * Kept independent of any UI framework or fulfillment provider so the
 * storefront's catalog page (and its tests) can reason about search,
 * filtering, and pagination without a live adapter or DOM.
 */

import type { Product } from "./types.ts";

/** Query parameters accepted by {@link filterAndPaginateProducts}. */
export interface CatalogQuery {
  /** Free-text search applied to product name/description. */
  query?: string;
  /** Restrict results to a single category id. */
  categoryId?: string;
  /** Restrict results to products carrying this tag id. */
  tagId?: string;
  /** 1-based page number. Defaults to 1. Values below 1 are clamped. */
  page?: number;
  /** Items per page. Defaults to 12. Values below 1 are clamped. */
  pageSize?: number;
}

/** A single page of catalog results plus pagination metadata. */
export interface CatalogPage {
  items: Product[];
  /** Total number of products matching the filters, across all pages. */
  total: number;
  /** The (clamped) 1-based page number actually returned. */
  page: number;
  /** The (clamped) page size actually used. */
  pageSize: number;
  /** Total number of pages available for the current filters. */
  totalPages: number;
}

const DEFAULT_PAGE_SIZE = 12;

/** Filters, searches, and paginates a product catalog. */
export function filterAndPaginateProducts(
  products: Product[],
  query: CatalogQuery = {},
): CatalogPage {
  const normalizedQuery = query.query?.trim().toLowerCase();

  const filtered = products.filter((product) => {
    if (query.categoryId && product.categoryId !== query.categoryId) {
      return false;
    }
    if (query.tagId && !product.tagIds.includes(query.tagId)) {
      return false;
    }
    if (normalizedQuery) {
      const haystack = `${product.name} ${product.description}`.toLowerCase();
      if (!haystack.includes(normalizedQuery)) {
        return false;
      }
    }
    return true;
  });

  const pageSize = Math.max(1, Math.floor(query.pageSize ?? DEFAULT_PAGE_SIZE));
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(Math.max(1, Math.floor(query.page ?? 1)), totalPages);
  const start = (page - 1) * pageSize;

  return {
    items: filtered.slice(start, start + pageSize),
    total: filtered.length,
    page,
    pageSize,
    totalPages,
  };
}

/** Derives the set of categories represented in a product list, in first-seen order. */
export function listCategoryIds(products: Product[]): string[] {
  const seen = new Set<string>();
  for (const product of products) {
    seen.add(product.categoryId);
  }
  return [...seen];
}

/** Returns whether any variant of a product is currently available. */
export function isProductInStock(product: Product): boolean {
  return product.variants.some((variant) => variant.isAvailable);
}

/** Returns the lowest-priced variant for a product, or undefined if it has none. */
export function lowestPricedVariant(product: Product) {
  return product.variants.reduce<Product["variants"][number] | undefined>(
    (lowest, variant) =>
      !lowest || variant.priceCents < lowest.priceCents ? variant : lowest,
    undefined,
  );
}
