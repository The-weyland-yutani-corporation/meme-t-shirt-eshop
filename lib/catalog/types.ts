/**
 * Catalog content model.
 *
 * These types describe the storefront's product catalog domain
 * (categories, tags, products, and their print-on-demand variants)
 * independent of any specific fulfillment provider. Fulfillment
 * providers (e.g. Printful) are integrated through the
 * `PrintProviderAdapter` interface in `./adapters/types`, so catalog
 * and checkout code can depend on these stable shapes rather than a
 * provider's wire format.
 */

/** A top-level grouping used for storefront navigation and filtering. */
export interface Category {
  /** Stable, URL-safe identifier, e.g. "hoodies". */
  id: string;
  /** Human-readable name, e.g. "Hoodies". */
  name: string;
  /** Optional short description shown on category listing pages. */
  description?: string;
  /** Optional id of a parent category, for nested category trees. */
  parentId?: string;
}

/** A free-form label used for search, filtering, and merchandising. */
export interface Tag {
  /** Stable, URL-safe identifier, e.g. "limited-edition". */
  id: string;
  /** Human-readable label, e.g. "Limited Edition". */
  label: string;
}

/** Supported measurement systems for variant dimensions, if present. */
export type SizeUnit = "in" | "cm";

/**
 * A single purchasable configuration of a product (e.g. a specific
 * size/color combination), mapped to a fulfillment provider's SKU.
 */
export interface ProductVariant {
  /** Stable, catalog-local identifier for this variant. */
  id: string;
  /** Id of the product this variant belongs to. */
  productId: string;
  /** Human-readable variant name, e.g. "Black / L". */
  name: string;
  /** Size label, e.g. "L", "XL". Omitted for size-less products. */
  size?: string;
  /** Color label, e.g. "Black". Omitted for color-less products. */
  color?: string;
  /** Price in the smallest currency unit (e.g. cents), always integer. */
  priceCents: number;
  /** ISO 4217 currency code, e.g. "USD". */
  currency: string;
  /** Identifier used to look up this variant with the fulfillment provider. */
  providerVariantId: string;
  /** Whether this variant is currently orderable. */
  isAvailable: boolean;
}

/** A sellable product shown in the storefront catalog. */
export interface Product {
  /** Stable, URL-safe identifier, e.g. "classic-meme-tee". */
  id: string;
  /** Display name. */
  name: string;
  /** Marketing/description copy. */
  description: string;
  /** Id of this product's primary category. */
  categoryId: string;
  /** Ids of tags associated with this product. */
  tagIds: string[];
  /** Purchasable variants for this product. Must contain at least one. */
  variants: ProductVariant[];
  /** Image URLs for the product, in display order. */
  images: string[];
}
