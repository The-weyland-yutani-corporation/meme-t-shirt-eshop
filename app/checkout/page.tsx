import Link from "next/link";
import { reviewPurchase } from "../../lib/orders/simulation.ts";
import { formatPrice } from "../lib/format.ts";
import { finishSimulation } from "./actions.ts";

export const metadata = { title: "Review simulated purchase | Meme T-Shirt Eshop", robots: { index: false } };

export default async function CheckoutPage({ searchParams }: {
  searchParams: Promise<{ variantId?: string; quantity?: string; error?: string }>;
}) {
  const params = await searchParams;
  let purchase;
  try {
    purchase = await reviewPurchase(params.variantId, params.quantity);
  } catch {
    return <main id="main-content" className="container narrow">
      <p className="eyebrow">Simulation only</p><h1>Cannot review this selection</h1>
      <p role="alert">Choose an available variant and a whole-number quantity from 1 to 10. Nothing was ordered or charged.</p>
      <Link className="button" href="/catalog">Return to catalog</Link>
    </main>;
  }
  const { product, variant, quantity, totalCents } = purchase;
  return <main id="main-content" className="container narrow">
    <p className="eyebrow">Step 2 of 3 · Simulation only</p>
    <h1>Review your demo cart</h1>
    <p>No payment. No shipment. No personal details required.</p>
    <section className="panel" aria-label="Server-calculated order summary">
      <h2>{product.name}</h2><p>{variant.name} × {quantity}</p>
      <dl className="summary">
        <dt>Unit price</dt><dd>{formatPrice(variant.priceCents, variant.currency)}</dd>
        <dt>Demo total</dt><dd>{formatPrice(totalCents, variant.currency)}</dd>
        <dt>Amount charged</dt><dd>{formatPrice(0, variant.currency)}</dd>
      </dl>
      <p>Availability and catalog prices are checked again when you complete or cancel.</p>
      <form action={finishSimulation} className="actions">
        <input type="hidden" name="variantId" value={variant.id} />
        <input type="hidden" name="quantity" value={quantity} />
        <button name="action" value="complete">Complete simulated purchase</button>
        <button className="secondary" name="action" value="cancel">Cancel simulation</button>
      </form>
    </section>
    <Link href={`/catalog/${product.id}`}>Change variant or quantity</Link>
  </main>;
}
