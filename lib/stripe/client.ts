import Stripe from "stripe";

let cachedClient: Stripe | null = null;

/**
 * Lazily constructs a singleton Stripe client from the STRIPE_SECRET_KEY
 * environment variable. Throws only when actually invoked (not at import
 * time) so routes that don't need Stripe can still be imported/tested
 * without the secret configured.
 */
export function getStripeClient(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error(
      "STRIPE_SECRET_KEY is not configured. Set it in the environment to use Stripe Checkout."
    );
  }
  if (process.env.STRIPE_SANDBOX_ENABLED !== "true") {
    throw new Error("Stripe sandbox is disabled. Set STRIPE_SANDBOX_ENABLED=true explicitly.");
  }
  if (!/^sk_test_[A-Za-z0-9_]+$/.test(secretKey)) {
    throw new Error("Only a Stripe test secret key is permitted.");
  }
  if (cachedClient) return cachedClient;

  cachedClient = new Stripe(secretKey, {
    apiVersion: "2025-02-24.acacia",
  });

  return cachedClient;
}

/** Test-only hook to reset the cached client between test runs. */
export function resetStripeClientForTests(): void {
  cachedClient = null;
}
