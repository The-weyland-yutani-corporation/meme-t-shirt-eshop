import { createHash } from "node:crypto";
import { MockPrintProviderAdapter } from "../catalog/adapters/mock-adapter.ts";
import type { PrintProviderAdapter } from "../catalog/adapters/types.ts";

export function parseQuantity(value: unknown): number {
  if (typeof value === "string" && /^[1-9]\d*$/.test(value)) value = Number(value);
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1 || value > 10) {
    throw new Error("Choose a whole-number quantity from 1 to 10.");
  }
  return value;
}

export async function reviewPurchase(
  variantId: unknown,
  quantityInput: unknown,
  provider: PrintProviderAdapter = new MockPrintProviderAdapter(),
) {
  if (typeof variantId !== "string" || !variantId || variantId.length > 120) {
    throw new Error("Choose a valid catalog variant.");
  }
  const quantity = parseQuantity(quantityInput);
  const variant = await provider.getVariant(variantId);
  if (!(await provider.checkAvailability(variant.id))) {
    throw new Error("This variant is unavailable. Please choose another item.");
  }
  const product = await provider.getProduct(variant.productId);
  const totalCents = variant.priceCents * quantity;
  if (!Number.isSafeInteger(totalCents)) throw new Error("Invalid catalog total.");
  // A reproducible demo reference, not a secret, payment proof, or stored order ID.
  const reference = `SIM-${createHash("sha256")
    .update(JSON.stringify([variant.id, quantity, variant.priceCents, variant.currency]))
    .digest("hex").slice(0, 12).toUpperCase()}`;
  return { product, variant, quantity, totalCents, reference };
}

export function simulationUrl(variantId: string, quantity: number, status?: "completed" | "cancelled") {
  const query = new URLSearchParams({ variantId, quantity: String(quantity) });
  if (status) query.set("status", status);
  return `${status ? "/orders" : "/checkout"}?${query}`;
}
