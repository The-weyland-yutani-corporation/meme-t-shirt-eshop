/**
 * Minimal in-memory order store used to demonstrate idempotent webhook
 * processing (R5, R8). This is intentionally swappable: a future storefront
 * milestone can replace the Map-backed implementation with a real database
 * without changing the webhook handler's contract.
 */

export type OrderStatus = "pending" | "paid" | "failed";

export interface Order {
  id: string;
  checkoutSessionId: string;
  status: OrderStatus;
  amountTotal: number | null;
  currency: string | null;
  customerEmail: string | null;
  createdAt: string;
  updatedAt: string;
}

const ordersByCheckoutSessionId = new Map<string, Order>();
const processedEventIds = new Set<string>();

/**
 * Records that a Stripe event has been processed. Returns false if the event
 * was already processed (duplicate delivery), in which case the caller
 * should skip re-applying side effects.
 */
export function markEventProcessed(eventId: string): boolean {
  if (processedEventIds.has(eventId)) {
    return false;
  }
  processedEventIds.add(eventId);
  return true;
}

export function hasProcessedEvent(eventId: string): boolean {
  return processedEventIds.has(eventId);
}

/**
 * Reverts a previously recorded "processed" marker. Used when handling an
 * event fails after it was marked processed, so a genuine Stripe retry of
 * the same event ID is not treated as a duplicate and can be reprocessed.
 */
export function unmarkEventProcessed(eventId: string): void {
  processedEventIds.delete(eventId);
}

export function upsertOrderFromCheckoutSession(params: {
  checkoutSessionId: string;
  status: OrderStatus;
  amountTotal: number | null;
  currency: string | null;
  customerEmail: string | null;
}): Order {
  const now = new Date().toISOString();
  const existing = ordersByCheckoutSessionId.get(params.checkoutSessionId);

  const order: Order = {
    id: existing?.id ?? `order_${params.checkoutSessionId}`,
    checkoutSessionId: params.checkoutSessionId,
    status: params.status,
    amountTotal: params.amountTotal,
    currency: params.currency,
    customerEmail: params.customerEmail,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  ordersByCheckoutSessionId.set(params.checkoutSessionId, order);
  return order;
}

export function getOrderByCheckoutSessionId(
  checkoutSessionId: string
): Order | undefined {
  return ordersByCheckoutSessionId.get(checkoutSessionId);
}

/** Test-only hook to reset state between test runs. */
export function resetOrderStoreForTests(): void {
  ordersByCheckoutSessionId.clear();
  processedEventIds.clear();
}
