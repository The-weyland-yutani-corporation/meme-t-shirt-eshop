import Link from "next/link";
import { notFound } from "next/navigation";
import { ProviderNotFoundError } from "../../../lib/catalog/adapters/types.ts";
import { getProvider } from "../../lib/provider.ts";
import { formatPrice } from "../../lib/format.ts";
import { JsonLd } from "../../lib/JsonLd.tsx";
import { productJsonLd } from "../../lib/structured-data.ts";

interface ProductPageProps {
  params: Promise<{ productId: string }>;
}

export async function generateMetadata({ params }: ProductPageProps) {
  const { productId } = await params;
  const provider = getProvider();
  try {
    const product = await provider.getProduct(productId);
    return {
      title: `${product.name} | Meme T-Shirt Eshop`,
      description: product.description,
    };
  } catch {
    return { title: "Product not found | Meme T-Shirt Eshop" };
  }
}

export default async function ProductDetailPage({ params }: ProductPageProps) {
  const { productId } = await params;
  const provider = getProvider();

  let product;
  try {
    product = await provider.getProduct(productId);
  } catch (error) {
    if (error instanceof ProviderNotFoundError) {
      notFound();
    }
    throw error;
  }

  return (
    <main id="main-content" className="container">
      <JsonLd data={productJsonLd(product)} />
      <nav aria-label="Breadcrumb" style={{ marginBottom: "1rem" }}>
        <Link href="/catalog">&larr; Back to catalog</Link>
      </nav>

      <article className="product-detail">
        <div>
        <p className="eyebrow">Original apparel concept</p>
        <h1>{product.name}</h1>

        {product.images.length > 0 && (
          <div
            role="group"
            aria-label="Product images"
            style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", margin: "1rem 0" }}
          >
            {product.images.map((image) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={image}
                src={image}
                alt={product.name}
                width={640}
                height={640}
                className="product-art"
              />
            ))}
          </div>
        )}

        </div>
        <div>
        <p className="lede">{product.description}</p>
        <h2>Try a simulated purchase</h2>
        <p>No payment, no shipment, no personal details. Quantity limit: 10 per simulation.</p>
        <form action="/checkout" method="get" className="purchase-form">
          <label htmlFor="variant">Variant</label>
          <select id="variant" name="variantId" required defaultValue={product.variants.find((v) => v.isAvailable)?.id ?? ""}>
            <option value="" disabled>Choose a variant</option>
            {product.variants.map((variant) => <option key={variant.id} value={variant.id} disabled={!variant.isAvailable}>
              {variant.name} — {formatPrice(variant.priceCents, variant.currency)}{!variant.isAvailable ? " — unavailable" : ""}
            </option>)}
          </select>
          <label htmlFor="quantity">Quantity</label>
          <input id="quantity" name="quantity" type="number" min="1" max="10" step="1" defaultValue="1" required />
          <button type="submit" disabled={!product.variants.some((v) => v.isAvailable)}>Review simulated purchase</button>
        </form>
        {!product.variants.some((v) => v.isAvailable) && <p role="status">All variants are unavailable. <Link href="/catalog">Explore other designs</Link>.</p>}

        <h2>Variants</h2>
        <div className="table-scroll"><table>
          <caption className="sr-only">Available variants, pricing, and stock</caption>
          <thead>
            <tr>
              <th scope="col">Variant</th>
              <th scope="col">Size</th>
              <th scope="col">Color</th>
              <th scope="col">Price</th>
              <th scope="col">Availability</th>
            </tr>
          </thead>
          <tbody>
            {product.variants.map((variant) => (
              <tr key={variant.id}>
                <th scope="row">{variant.name}</th>
                <td>{variant.size ?? "—"}</td>
                <td>{variant.color ?? "—"}</td>
                <td>{formatPrice(variant.priceCents, variant.currency)}</td>
                <td>
                  <span aria-label={variant.isAvailable ? "In stock" : "Out of stock"}>
                    {variant.isAvailable ? "In stock" : "Out of stock"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
        </div>
      </article>
    </main>
  );
}
