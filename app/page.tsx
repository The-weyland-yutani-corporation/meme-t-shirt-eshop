import Link from "next/link";

export default function Home() {
  return (
    <main style={{ fontFamily: "sans-serif", padding: "2rem" }}>
      <h1>Meme T-Shirt Eshop</h1>
      <p>Coming soon.</p>
      <p>
        <Link href="/catalog">Browse the catalog</Link>
      </p>
    </main>
  );
}
