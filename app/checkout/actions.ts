"use server";

import { redirect } from "next/navigation";
import { reviewPurchase, simulationUrl } from "../../lib/orders/simulation.ts";

export async function finishSimulation(form: FormData) {
  let destination = "/checkout?error=invalid";
  try {
    const purchase = await reviewPurchase(form.get("variantId"), form.get("quantity"));
    const action = form.get("action");
    if (action !== "complete" && action !== "cancel") throw new Error("Invalid action.");
    destination = simulationUrl(purchase.variant.id, purchase.quantity, action === "complete" ? "completed" : "cancelled");
  } catch {
    // No customer input is echoed into a redirect or sent to a provider.
  }
  redirect(destination);
}
