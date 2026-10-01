/**
 * Contract tests for the in-memory order store's idempotent webhook
 * processing helpers (R5, R8), covering the behavior the Stripe webhook
 * route depends on: skipping duplicate event deliveries, and allowing a
 * retried event to be reprocessed after a failed handler unmarks it.
 */

import assert from "node:assert/strict";
import { test, beforeEach } from "node:test";

import {
  getOrderByCheckoutSessionId,
  hasProcessedEvent,
  markEventProcessed,
  resetOrderStoreForTests,
  unmarkEventProcessed,
  upsertOrderFromCheckoutSession,
} from "../store.ts";

beforeEach(() => {
  resetOrderStoreForTests();
});

test("markEventProcessed returns true for a new event id", () => {
  assert.equal(markEventProcessed("evt_1"), true);
  assert.equal(hasProcessedEvent("evt_1"), true);
});

test("markEventProcessed returns false for an already-processed event id", () => {
  assert.equal(markEventProcessed("evt_1"), true);
  assert.equal(markEventProcessed("evt_1"), false);
});

test("unmarkEventProcessed allows a retried event to be reprocessed", () => {
  assert.equal(markEventProcessed("evt_1"), true);
  unmarkEventProcessed("evt_1");
  assert.equal(hasProcessedEvent("evt_1"), false);
  assert.equal(markEventProcessed("evt_1"), true);
});

test("upsertOrderFromCheckoutSession creates a new order on first call", () => {
  const order = upsertOrderFromCheckoutSession({
    checkoutSessionId: "cs_1",
    status: "paid",
    amountTotal: 2499,
    currency: "usd",
    customerEmail: "ripley@example.com",
  });

  assert.equal(order.checkoutSessionId, "cs_1");
  assert.equal(order.status, "paid");
  assert.equal(order.amountTotal, 2499);
  assert.equal(getOrderByCheckoutSessionId("cs_1")?.id, order.id);
});

test("upsertOrderFromCheckoutSession updates an existing order in place", () => {
  const created = upsertOrderFromCheckoutSession({
    checkoutSessionId: "cs_1",
    status: "pending",
    amountTotal: 2499,
    currency: "usd",
    customerEmail: null,
  });

  const updated = upsertOrderFromCheckoutSession({
    checkoutSessionId: "cs_1",
    status: "failed",
    amountTotal: 2499,
    currency: "usd",
    customerEmail: null,
  });

  assert.equal(updated.id, created.id);
  assert.equal(updated.status, "failed");
  assert.equal(updated.createdAt, created.createdAt);
});

test("getOrderByCheckoutSessionId returns undefined for an unknown session", () => {
  assert.equal(getOrderByCheckoutSessionId("does-not-exist"), undefined);
});
