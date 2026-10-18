import { reviewPurchase } from "../orders/simulation.ts";

export function isStripeSandboxEnabled() {
  return process.env.STRIPE_SANDBOX_ENABLED === "true" &&
    /^sk_test_[A-Za-z0-9_]+$/.test(process.env.STRIPE_SECRET_KEY ?? "");
}

export function checkoutDestination(value: unknown, origin: string): string {
  if (typeof value !== "string") throw new Error("Invalid checkout destination.");
  const url = new URL(value, origin);
  if (url.origin !== origin || url.username || url.password || url.search || url.hash ||
      !["/checkout", "/catalog", "/orders"].includes(url.pathname)) {
    throw new Error("Checkout destinations must be allowlisted same-origin pages.");
  }
  return url.href;
}

export async function sandboxCheckoutInput(body: unknown, origin: string) {
  if (!body || typeof body !== "object") throw new Error("Invalid checkout body.");
  const input = body as Record<string, unknown>;
  if (!Array.isArray(input.lineItems) || input.lineItems.length < 1 || input.lineItems.length > 10) {
    throw new Error("Provide 1 to 10 catalog line items.");
  }
  const lineItems = await Promise.all(input.lineItems.map(async (item: unknown) => {
    if (!item || typeof item !== "object") throw new Error("Invalid line item.");
    const line = item as Record<string, unknown>;
    // Stripe's JSON API requires numeric quantities, unlike HTML form inputs.
    if (typeof line.quantity !== "number") throw new Error("Quantity must be an integer.");
    const purchase = await reviewPurchase(line.variantId, line.quantity);
    if (line.amount !== undefined && line.amount !== purchase.variant.priceCents) throw new Error("Price mismatch.");
    if (line.currency !== undefined && line.currency !== purchase.variant.currency.toLowerCase()) throw new Error("Currency mismatch.");
    return {
      quantity: purchase.quantity,
      price_data: {
        currency: purchase.variant.currency.toLowerCase(),
        product_data: { name: `${purchase.product.name} — ${purchase.variant.name}` },
        unit_amount: purchase.variant.priceCents,
      },
    };
  }));
  const currencies = new Set(lineItems.map((item) => item.price_data.currency));
  if (currencies.size !== 1) throw new Error("Mixed currencies are not supported.");
  return {
    line_items: lineItems,
    success_url: checkoutDestination(input.successUrl, origin),
    cancel_url: checkoutDestination(input.cancelUrl, origin),
  };
}
