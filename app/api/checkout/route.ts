import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripeClient } from "@/lib/stripe/client";

interface CheckoutLineItemInput {
  name: string;
  amount: number;
  currency?: string;
  quantity?: number;
}

interface CreateCheckoutSessionBody {
  lineItems: CheckoutLineItemInput[];
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
}

function isValidLineItem(item: unknown): item is CheckoutLineItemInput {
  if (typeof item !== "object" || item === null) return false;
  const candidate = item as Record<string, unknown>;
  return (
    typeof candidate.name === "string" &&
    candidate.name.trim().length > 0 &&
    typeof candidate.amount === "number" &&
    Number.isInteger(candidate.amount) &&
    candidate.amount > 0 &&
    (candidate.quantity === undefined ||
      (typeof candidate.quantity === "number" && candidate.quantity > 0)) &&
    (candidate.currency === undefined || typeof candidate.currency === "string")
  );
}

function isValidBody(body: unknown): body is CreateCheckoutSessionBody {
  if (typeof body !== "object" || body === null) return false;
  const candidate = body as Record<string, unknown>;
  return (
    Array.isArray(candidate.lineItems) &&
    candidate.lineItems.length > 0 &&
    candidate.lineItems.every(isValidLineItem) &&
    typeof candidate.successUrl === "string" &&
    candidate.successUrl.trim().length > 0 &&
    typeof candidate.cancelUrl === "string" &&
    candidate.cancelUrl.trim().length > 0
  );
}

/**
 * Creates a Stripe Checkout Session in test mode for the given cart line
 * items. This module is intentionally isolated from any catalog/cart UI
 * logic per the security-sensitive isolation note on the source issue.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  if (!isValidBody(body)) {
    return NextResponse.json(
      {
        error:
          "Request body must include a non-empty lineItems array (name, amount in minor units, optional quantity/currency), successUrl, and cancelUrl.",
      },
      { status: 400 }
    );
  }

  const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] =
    body.lineItems.map((item) => ({
      quantity: item.quantity ?? 1,
      price_data: {
        currency: item.currency ?? "usd",
        product_data: { name: item.name },
        unit_amount: item.amount,
      },
    }));

  try {
    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items,
      success_url: body.successUrl,
      cancel_url: body.cancelUrl,
      customer_email: body.customerEmail,
    });

    return NextResponse.json({ id: session.id, url: session.url });
  } catch (error) {
    console.error("Failed to create Stripe Checkout session", error);
    return NextResponse.json(
      { error: "Unable to create checkout session." },
      { status: 502 }
    );
  }
}
