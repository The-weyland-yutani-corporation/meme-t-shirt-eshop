/**
 * JSON-LD structured data builders (SEO).
 *
 * Produces schema.org `Product` / `ItemList` payloads for the catalog and
 * product-detail pages, plus a small helper to safely embed them in a
 * `<script type="application/ld+json">` tag via `dangerouslySetInnerHTML`.
 * JSON.stringify output is escaped for `</script>` to avoid breaking out of
 * the script tag if a product name/description ever contained it.
 */

import type { Product } from "@/lib/catalog";
import { absoluteUrl, siteName } from "./site-config.ts";

/** Escapes `</script>`-breaking sequences inside embedded JSON-LD. */
function escapeForScriptTag(json: string): string {
  return json.replace(/</g, "\\u003c");
}

/** Builds `script` props (including the escaped JSON string) for JSON-LD. */
export function jsonLdScriptProps(data: unknown): {
  type: string;
  dangerouslySetInnerHTML: { __html: string };
} {
  return {
    type: "application/ld+json",
    dangerouslySetInnerHTML: {
      __html: escapeForScriptTag(JSON.stringify(data)),
    },
  };
}

/** Builds a schema.org `Product` JSON-LD payload for a single product. */
export function productJsonLd(product: Product): Record<string, unknown> {
  const lowestVariant = product.variants.reduce<
    (typeof product.variants)[number] | undefined
  >((lowest, variant) => {
    if (!lowest || variant.priceCents < lowest.priceCents) return variant;
    return lowest;
  }, undefined);

  const inStock = product.variants.some((variant) => variant.isAvailable);

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    image: product.images.map((image) => absoluteUrl(image)),
    url: absoluteUrl(`/catalog/${product.id}`),
    offers: lowestVariant
      ? {
          "@type": "AggregateOffer",
          lowPrice: (lowestVariant.priceCents / 100).toFixed(2),
          priceCurrency: lowestVariant.currency,
          offerCount: product.variants.length,
          availability: inStock
            ? "https://schema.org/InStock"
            : "https://schema.org/OutOfStock",
        }
      : undefined,
  };
}

/** Builds a schema.org `ItemList` JSON-LD payload for a catalog listing page. */
export function catalogItemListJsonLd(products: Product[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${siteName} Catalog`,
    itemListElement: products.map((product, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: absoluteUrl(`/catalog/${product.id}`),
      name: product.name,
    })),
  };
}
