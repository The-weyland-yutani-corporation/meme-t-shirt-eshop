import Link from "next/link";
import {
  filterAndPaginateProducts,
  isProductInStock,
  listCategoryIds,
  lowestPricedVariant,
} from "../../lib/catalog/index.ts";
import { getProvider } from "../lib/provider.ts";
import { formatPrice } from "../lib/format.ts";
import { JsonLd } from "../lib/JsonLd.tsx";
import { catalogItemListJsonLd } from "../lib/structured-data.ts";

export const metadata = {
  title: "Catalog | Meme T-Shirt Eshop",
  description:
    "Browse original apparel concepts and try a simulated purchase. No payment or shipment.",
};

interface CatalogPageProps {
  searchParams: Promise<{
    q?: string;
    category?: string;
    page?: string;
  }>;
}

const PAGE_SIZE = 8;

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const params = await searchParams;
  const provider = getProvider();
  const products = await provider.listProducts();

  const categoryIds = listCategoryIds(products);
  const requestedPage = Number.parseInt(params.page ?? "1", 10);

  const result = filterAndPaginateProducts(products, {
    query: params.q,
    categoryId: params.category,
    page: Number.isNaN(requestedPage) ? 1 : requestedPage,
    pageSize: PAGE_SIZE,
  });

  function pageHref(page: number): string {
    const search = new URLSearchParams();
    if (params.q) search.set("q", params.q);
    if (params.category) search.set("category", params.category);
    if (page > 1) search.set("page", String(page));
    const qs = search.toString();
    return qs ? `/catalog?${qs}` : "/catalog";
  }

  return (
    <main id="main-content" className="container">
      <JsonLd data={catalogItemListJsonLd(result.items)} />
      <p className="eyebrow">The mood board</p>
      <h1>Catalog</h1>
      <p className="lede">Original concepts for your everyday internet mood. Demo availability only — no real stock or fulfillment.</p>

      <form
        role="search"
        aria-label="Catalog search and filters"
        method="get"
        className="filters"
      >
        <label htmlFor="catalog-search">
          Search
          <input
            id="catalog-search"
            type="search"
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="Search products…"
            style={{ display: "block" }}
          />
        </label>

        <label htmlFor="catalog-category">
          Category
          <select
            id="catalog-category"
            name="category"
            defaultValue={params.category ?? ""}
            style={{ display: "block" }}
          >
            <option value="">All categories</option>
            {categoryIds.map((categoryId) => (
              <option key={categoryId} value={categoryId}>
                {categoryId}
              </option>
            ))}
          </select>
        </label>

        <button type="submit" style={{ alignSelf: "flex-end" }}>
          Apply
        </button>
        <Link href="/catalog">Clear filters</Link>
      </form>

      <p aria-live="polite">
        {result.total === 0
          ? "No products match your search."
          : `Showing ${result.items.length} of ${result.total} product(s).`}
      </p>

      <ul className="product-grid">
        {result.items.map((product) => {
          const variant = lowestPricedVariant(product);
          const inStock = isProductInStock(product);
          return (
            <li
              key={product.id}
              className="product-card"
            >
              <Link href={`/catalog/${product.id}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={product.images[0]} alt={`${product.name} original concept artwork`} width="640" height="640" />
                <h2 style={{ fontSize: "1.1rem" }}>{product.name}</h2>
              </Link>
              <p>{product.description}</p>
              {variant && (
                <p>
                  From {formatPrice(variant.priceCents, variant.currency)}
                </p>
              )}
              <p className="stock">{inStock ? "Available to simulate" : "Unavailable in demo"}</p>
              <Link href={`/catalog/${product.id}`}>View design & variants →</Link>
            </li>
          );
        })}
      </ul>

      <nav aria-label="Catalog pagination" style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem" }}>
        {result.page > 1 && (
          <Link href={pageHref(result.page - 1)} rel="prev">
            Previous
          </Link>
        )}
        <span>
          Page {result.page} of {result.totalPages}
        </span>
        {result.page < result.totalPages && (
          <Link href={pageHref(result.page + 1)} rel="next">
            Next
          </Link>
        )}
      </nav>
    </main>
  );
}
