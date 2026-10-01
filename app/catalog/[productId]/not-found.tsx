import Link from "next/link";

export default function ProductNotFound() {
  return (
    <main style={{ fontFamily: "sans-serif", padding: "2rem" }}>
      <h1>Product not found</h1>
      <p>We couldn&apos;t find the product you were looking for.</p>
      <Link href="/catalog">Browse the catalog</Link>
    </main>
  );
}
