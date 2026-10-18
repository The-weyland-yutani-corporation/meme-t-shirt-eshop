import Link from "next/link";
import { reviewPurchase } from "../../lib/orders/simulation.ts";
import { formatPrice } from "../lib/format.ts";

export const metadata = { title: "Simulated order status | Meme T-Shirt Eshop", robots: { index: false } };

export default async function OrderStatusPage({ searchParams }: {
  searchParams: Promise<{ variantId?: string; quantity?: string; status?: string }>;
}) {
  const params = await searchParams;
  let purchase;
  try {
    if (params.status !== "completed" && params.status !== "cancelled") throw new Error("Invalid status.");
    purchase = await reviewPurchase(params.variantId, params.quantity);
  } catch {
    return <main id="main-content" className="container narrow">
      <h1>No valid simulated order selected</h1>
      <p>This link is invalid, or the catalog selection is no longer available. No payment or shipment exists.</p>
      <Link className="button" href="/catalog">Start a new simulation</Link>
    </main>;
  }
  const cancelled = params.status === "cancelled";
  return <main id="main-content" className="container narrow">
    <p className="eyebrow">Step 3 of 3 · Simulation only</p>
    <h1>{cancelled ? "Simulation cancelled" : "Simulated purchase complete"}</h1>
    <p>No payment was taken. Nothing will be shipped.</p>
    <section className="panel" aria-label="Simulated order status">
      <h2>{cancelled ? "Cancelled" : "Demo confirmation"}</h2>
      <p>Demo reference: <strong>{purchase.reference}</strong></p>
      <p>{purchase.product.name} · {purchase.variant.name} × {purchase.quantity}</p>
      <p>Demo total: {formatPrice(purchase.totalCents, purchase.variant.currency)} · Charged: {formatPrice(0, purchase.variant.currency)}</p>
      <p>Status: {cancelled ? "cancelled — no order created" : "simulated — not sent for fulfillment"}</p>
    </section>
    <p>This is a reproducible demo, not a stored order or proof of purchase. The URL describes the selection and status; editing it can recreate a result. Repeating the same selection gives the same reference. Prices and availability follow the current catalog; stock is not reserved or decremented.</p>
    <Link className="button" href="/catalog">Browse and simulate again</Link>
  </main>;
}
