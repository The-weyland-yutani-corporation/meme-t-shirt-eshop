import { NextRequest, NextResponse } from "next/server";
import { getStripeClient } from "../../../lib/stripe/client.ts";
import { isStripeSandboxEnabled, sandboxCheckoutInput } from "../../../lib/stripe/sandbox.ts";

export async function POST(request: NextRequest) {
  if (!isStripeSandboxEnabled()) {
    return NextResponse.json({ error: "Stripe sandbox is disabled. Use the simulated storefront." }, { status: 403 });
  }
  if (request.headers.get("origin") !== request.nextUrl.origin) {
    return NextResponse.json({ error: "Same-origin requests are required." }, { status: 403 });
  }
  let input;
  try {
    input = await sandboxCheckoutInput(await request.json(), request.nextUrl.origin);
  } catch {
    return NextResponse.json({ error: "Invalid catalog items, quantities, prices, availability, or return destinations." }, { status: 400 });
  }
  try {
    const session = await getStripeClient().checkout.sessions.create({ mode: "payment", ...input });
    return NextResponse.json({ id: session.id, url: session.url });
  } catch {
    return NextResponse.json({ error: "Unable to create sandbox checkout session." }, { status: 502 });
  }
}
