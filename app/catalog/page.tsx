import Link from "next/link";
import {
  filterAndPaginateProducts,
  isProductInStock,
  listCategoryIds,
  lowestPricedVariant,
} from "@/lib/catalog";
import { getProvider } from "@/app/lib/provider";
import { formatPrice } from "@/app/lib/format";

export const metadata = {
  title: "Catalog | Meme T-Shirt Eshop",
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
    <main style={{ fontFamily: "sans-serif", padding: "2rem" }}>
      <h1>Catalog</h1>

      <form
        role="search"
        aria-label="Catalog search and filters"
        method="get"
        style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1.5rem" }}
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
      </form>

      <p aria-live="polite">
        {result.total === 0
          ? "No products match your search."
          : `Showing ${result.items.length} of ${result.total} product(s).`}
      </p>

      <ul
        style={{
          listStyle: "none",
          padding: 0,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: "1.25rem",
        }}
      >
        {result.items.map((product) => {
          const variant = lowestPricedVariant(product);
          const inStock = isProductInStock(product);
          return (
            <li
              key={product.id}
              style={{ border: "1px solid #ddd", borderRadius: "8px", padding: "1rem" }}
            >
              <Link href={`/catalog/${product.id}`}>
                <h2 style={{ fontSize: "1.1rem" }}>{product.name}</h2>
              </Link>
              <p>{product.description}</p>
              {variant && (
                <p>
                  From {formatPrice(variant.priceCents, variant.currency)}
                </p>
              )}
              <p>{inStock ? "In stock" : "Out of stock"}</p>
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
