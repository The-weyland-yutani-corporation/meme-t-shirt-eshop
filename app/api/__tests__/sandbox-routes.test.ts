import assert from "node:assert/strict";
import path from "node:path";
import { afterEach, beforeEach, test } from "node:test";
import { NextRequest } from "next/server.js";
import Stripe from "stripe";
import { loadAppModule } from "../../../lib/testing/render-app-page.ts";

type Route = { POST(request: NextRequest): Promise<Response> };
const checkout = loadAppModule<Route>(path.resolve("app/api/checkout/route.ts"));
const webhook = loadAppModule<Route>(path.resolve("app/api/webhooks/stripe/route.ts"));
const original = {
  enabled: process.env.STRIPE_SANDBOX_ENABLED,
  key: process.env.STRIPE_SECRET_KEY,
  webhook: process.env.STRIPE_WEBHOOK_SECRET,
};
beforeEach(() => {
  delete process.env.STRIPE_SANDBOX_ENABLED;
  process.env.STRIPE_SECRET_KEY = "sk_test_fake_route_contract";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_fake_route_contract";
});
afterEach(() => {
  for (const [name, value] of [
    ["STRIPE_SANDBOX_ENABLED", original.enabled],
    ["STRIPE_SECRET_KEY", original.key],
    ["STRIPE_WEBHOOK_SECRET", original.webhook],
  ]) {
    if (value === undefined) delete process.env[name!];
    else process.env[name!] = value;
  }
});

test("legacy checkout and webhook routes are disabled by default and reject live keys", async () => {
  for (const route of [checkout, webhook]) {
    assert.equal((await route.POST(new NextRequest("https://demo.example/api", { method: "POST" }))).status, 403);
    process.env.STRIPE_SANDBOX_ENABLED = "true";
    process.env.STRIPE_SECRET_KEY = "sk_live_fake_route_contract";
    assert.equal((await route.POST(new NextRequest("https://demo.example/api", { method: "POST" }))).status, 403);
    delete process.env.STRIPE_SANDBOX_ENABLED;
    process.env.STRIPE_SECRET_KEY = "sk_test_fake_route_contract";
  }
});

test("sandbox checkout rejects wrong origin, malformed JSON and forged cart before network access", async () => {
  process.env.STRIPE_SANDBOX_ENABLED = "true";
  assert.equal((await checkout.POST(new NextRequest("https://demo.example/api/checkout", {
    method: "POST", headers: { origin: "https://evil.example" }, body: "{}",
  }))).status, 403);
  for (const body of ["{", JSON.stringify({
    lineItems: [{ variantId: "classic-meme-tee-s-black", quantity: 1, amount: 1 }],
    successUrl: "/orders", cancelUrl: "/catalog",
  })]) {
    assert.equal((await checkout.POST(new NextRequest("https://demo.example/api/checkout", {
      method: "POST", headers: { origin: "https://demo.example" }, body,
    }))).status, 400);
  }
});

test("sandbox webhook rejects signed live events and accepts test events idempotently", async () => {
  process.env.STRIPE_SANDBOX_ENABLED = "true";
  for (const live of [true, false, false]) {
    const body = JSON.stringify({
      id: live ? "evt_contract_live" : "evt_contract_test",
      object: "event", type: "checkout.session.completed", livemode: live,
      data: { object: { id: "cs_contract", livemode: live, amount_total: 2499, currency: "usd" } },
    });
    const signature = Stripe.webhooks.generateTestHeaderString({
      payload: body, secret: process.env.STRIPE_WEBHOOK_SECRET!,
    });
    const response = await webhook.POST(new NextRequest("https://demo.example/api/webhooks/stripe", {
      method: "POST", body, headers: { "stripe-signature": signature },
    }));
    assert.equal(response.status, live ? 400 : 200);
  }
});
