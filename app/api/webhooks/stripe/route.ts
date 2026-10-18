import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripeClient } from "@/lib/stripe/client";
import {
  markEventProcessed,
  unmarkEventProcessed,
  upsertOrderFromCheckoutSession,
} from "@/lib/orders/store";

// Stripe requires the raw request body for signature verification, so this
// route must not run through any body-parsing middleware.
export const runtime = "nodejs";

/**
 * Stripe webhook endpoint: verifies the signature against the raw body and
 * webhook secret, then processes checkout completion/failure events
 * idempotently by event ID (R5, R8). Duplicate deliveries of the same event
 * ID are acknowledged with 200 but not re-applied.
 */
export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET is not configured.");
    return NextResponse.json(
      { error: "Webhook is not configured." },
      { status: 500 }
    );
  }

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header." },
      { status: 400 }
    );
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    const stripe = getStripeClient();
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    console.error("Stripe webhook signature verification failed", error);
    return NextResponse.json(
      { error: "Invalid webhook signature." },
      { status: 400 }
    );
  }

  // Idempotency: skip already-processed events so retried/duplicate
  // deliveries never double-process an order.
  const isNewEvent = markEventProcessed(event.id);
  if (!isNewEvent) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as Stripe.Checkout.Session;
        upsertOrderFromCheckoutSession({
          checkoutSessionId: session.id,
          status: "paid",
          amountTotal: session.amount_total ?? null,
          currency: session.currency ?? null,
          customerEmail: session.customer_details?.email ?? null,
        });
        break;
      }
      case "checkout.session.async_payment_failed": {
        const session = event.data.object as Stripe.Checkout.Session;
        upsertOrderFromCheckoutSession({
          checkoutSessionId: session.id,
          status: "failed",
          amountTotal: session.amount_total ?? null,
          currency: session.currency ?? null,
          customerEmail: session.customer_details?.email ?? null,
        });
        break;
      }
      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        upsertOrderFromCheckoutSession({
          checkoutSessionId: session.id,
          status: "failed",
          amountTotal: session.amount_total ?? null,
          currency: session.currency ?? null,
          customerEmail: session.customer_details?.email ?? null,
        });
        break;
      }
      default:
        // Unhandled event types are acknowledged but ignored.
        break;
    }
  } catch (error) {
    // Failure recovery: unmark the event so a genuine Stripe retry of the
    // same event ID is reprocessed rather than silently dropped as a
    // duplicate, then return 500 so Stripe schedules a retry (R8).
    unmarkEventProcessed(event.id);
    console.error(`Failed to process Stripe event ${event.id}`, error);
    return NextResponse.json(
      { error: "Failed to process webhook event." },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}
