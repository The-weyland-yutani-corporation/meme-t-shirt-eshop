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
const ORIGINAL_SANDBOX = process.env.STRIPE_SANDBOX_ENABLED;

beforeEach(() => {
  resetStripeClientForTests();
  delete process.env.STRIPE_SECRET_KEY;
  process.env.STRIPE_SANDBOX_ENABLED = "true";
});

afterEach(() => {
  resetStripeClientForTests();
  if (ORIGINAL_SANDBOX === undefined) delete process.env.STRIPE_SANDBOX_ENABLED;
  else process.env.STRIPE_SANDBOX_ENABLED = ORIGINAL_SANDBOX;
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

test("getStripeClient rejects live keys and requires explicit sandbox opt-in", () => {
  process.env.STRIPE_SECRET_KEY = "sk_live_fake_contract_test";
  assert.throws(() => getStripeClient(), /Only a Stripe test/);
  process.env.STRIPE_SECRET_KEY = "sk_test_fake_contract_test";
  delete process.env.STRIPE_SANDBOX_ENABLED;
  assert.throws(() => getStripeClient(), /sandbox is disabled/);
});

test("cached clients cannot bypass a subsequently disabled sandbox", () => {
  process.env.STRIPE_SECRET_KEY = "sk_test_fake_contract_test";
  getStripeClient();
  process.env.STRIPE_SANDBOX_ENABLED = "false";
  assert.throws(() => getStripeClient(), /sandbox is disabled/);
  process.env.STRIPE_SANDBOX_ENABLED = "true";
  process.env.STRIPE_SECRET_KEY = "sk_live_fake_contract_test";
  assert.throws(() => getStripeClient(), /Only a Stripe test/);
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
