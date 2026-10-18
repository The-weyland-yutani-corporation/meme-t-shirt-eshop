import Link from "next/link";

export default function Home() {
  return (
    <main id="main-content" className="container">
      <section className="hero">
        <div>
          <p className="eyebrow">Original designs. Unoriginal coping mechanisms.</p>
          <h1>Wear your<br />current mood.</h1>
          <p className="lede">For the perpetually buffering and proudly offline. Explore original apparel concepts and try a purchase without spending a cent.</p>
          <Link className="button" href="/catalog">Explore the collection →</Link>
          <p className="note">Demo store · No payment · No shipment</p>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="hero-art" src="/images/classic-meme-tee.svg" width="640" height="640" alt="Original Brain Buffering tee concept on a lavender background" />
      </section>
      <section className="features" aria-label="How this demo works">
        <article><span className="eyebrow">01 · Explore</span><h2>Find your mood</h2><p>Local, original artwork. No third-party image downloads.</p></article>
        <article><span className="eyebrow">02 · Review</span><h2>Try a demo cart</h2><p>Pick a variant and quantity. The server checks price and availability.</p></article>
        <article><span className="eyebrow">03 · Simulate</span><h2>Zero commitments</h2><p>Complete or cancel. No account, card, address, or real order.</p></article>
      </section>
    </main>
  );
}
