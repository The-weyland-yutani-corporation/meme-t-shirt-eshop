/**
 * Contract tests for the Stripe client factory (R6: Stripe test coverage).
 *
 * These tests exercise `getStripeClient`'s configuration/error-handling
 * contract without making any live network calls to Stripe: constructing a
 * `Stripe` instance does not itself perform I/O, so these assertions are
 * safe to run in CI with no secrets configured.
 */

import assert from "node:assert/strict";
import { test, beforeEach, afterEach } from "node:test";

import { getStripeClient, resetStripeClientForTests } from "../client.ts";

const ORIGINAL_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

beforeEach(() => {
  resetStripeClientForTests();
  delete process.env.STRIPE_SECRET_KEY;
});

afterEach(() => {
  resetStripeClientForTests();
  if (ORIGINAL_SECRET_KEY === undefined) {
    delete process.env.STRIPE_SECRET_KEY;
  } else {
    process.env.STRIPE_SECRET_KEY = ORIGINAL_SECRET_KEY;
  }
});

test("getStripeClient throws when STRIPE_SECRET_KEY is not configured", () => {
  assert.throws(
    () => getStripeClient(),
    /STRIPE_SECRET_KEY is not configured/
  );
});

test("getStripeClient returns a client once STRIPE_SECRET_KEY is configured", () => {
  process.env.STRIPE_SECRET_KEY = "sk_test_fake_key_for_contract_tests";
  const client = getStripeClient();
  assert.ok(client);
  assert.equal(typeof client.checkout.sessions.create, "function");
  assert.equal(typeof client.webhooks.constructEvent, "function");
});

test("getStripeClient caches a singleton instance across calls", () => {
  process.env.STRIPE_SECRET_KEY = "sk_test_fake_key_for_contract_tests";
  const first = getStripeClient();
  const second = getStripeClient();
  assert.equal(first, second);
});

test("resetStripeClientForTests forces a fresh client on next call", () => {
  process.env.STRIPE_SECRET_KEY = "sk_test_fake_key_for_contract_tests";
  const first = getStripeClient();
  resetStripeClientForTests();
  const second = getStripeClient();
  assert.notEqual(first, second);
});
