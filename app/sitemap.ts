import type { MetadataRoute } from "next";
import { getProvider } from "./lib/provider.ts";
import { absoluteUrl } from "./lib/site-config.ts";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const provider = getProvider();
  const products = await provider.listProducts();

  return [
    {
      url: absoluteUrl("/"),
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: absoluteUrl("/catalog"),
      changeFrequency: "daily",
      priority: 0.9,
    },
    ...products.map((product) => ({
      url: absoluteUrl(`/catalog/${product.id}`),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
