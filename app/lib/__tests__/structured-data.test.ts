import assert from "node:assert/strict";
import { test } from "node:test";
import {
  catalogItemListJsonLd,
  jsonLdScriptProps,
  productJsonLd,
} from "../structured-data.ts";
import type { Product } from "../../../lib/catalog/types.ts";

const sampleProduct: Product = {
  id: "classic-meme-tee",
  name: "Classic Meme Tee",
  description: "A soft-cotton unisex tee.",
  categoryId: "t-shirts",
  tagIds: [],
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
    {
      id: "classic-meme-tee-m-black",
      productId: "classic-meme-tee",
      name: "Black / M",
      size: "M",
      color: "Black",
      priceCents: 1999,
      currency: "USD",
      providerVariantId: "pf-1002",
      isAvailable: false,
    },
  ],
};

test("productJsonLd builds a schema.org Product payload", () => {
  const data = productJsonLd(sampleProduct) as Record<string, unknown>;
  assert.equal(data["@type"], "Product");
  assert.equal(data.name, "Classic Meme Tee");
  const offers = data.offers as Record<string, unknown>;
  assert.equal(offers["@type"], "AggregateOffer");
  assert.equal(offers.lowPrice, "19.99");
  assert.equal(offers.priceCurrency, "USD");
  assert.equal(offers.availability, "https://schema.org/InStock");
});

test("catalogItemListJsonLd builds a schema.org ItemList payload", () => {
  const data = catalogItemListJsonLd([sampleProduct]) as Record<string, unknown>;
  assert.equal(data["@type"], "ItemList");
  const items = data.itemListElement as Record<string, unknown>[];
  assert.equal(items.length, 1);
  assert.equal(items[0].name, "Classic Meme Tee");
  assert.equal(items[0].position, 1);
});

test("jsonLdScriptProps escapes closing script tags", () => {
  const props = jsonLdScriptProps({ name: "</script><script>alert(1)" });
  assert.equal(props.type, "application/ld+json");
  assert.ok(!props.dangerouslySetInnerHTML.__html.includes("</script>"));
});
