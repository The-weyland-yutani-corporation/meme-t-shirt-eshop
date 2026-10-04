import Link from "next/link";
import { notFound } from "next/navigation";
import { ProviderNotFoundError } from "@/lib/catalog";
import { getProvider } from "@/app/lib/provider";
import { formatPrice } from "@/app/lib/format";
import { JsonLd } from "@/app/lib/JsonLd";
import { productJsonLd } from "@/app/lib/structured-data";

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
    <main style={{ fontFamily: "sans-serif", padding: "2rem" }}>
      <JsonLd data={productJsonLd(product)} />
      <nav aria-label="Breadcrumb" style={{ marginBottom: "1rem" }}>
        <Link href="/catalog">&larr; Back to catalog</Link>
      </nav>

      <article>
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
                width={200}
                height={200}
                style={{ objectFit: "cover", borderRadius: "8px" }}
              />
            ))}
          </div>
        )}

        <p>{product.description}</p>

        <h2>Variants</h2>
        <table>
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
        </table>
      </article>
    </main>
  );
}
