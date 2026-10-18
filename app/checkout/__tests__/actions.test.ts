import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { loadAppModule } from "../../../lib/testing/render-app-page.ts";

const { finishSimulation } = loadAppModule<{
  finishSimulation(form: FormData): Promise<never>;
}>(path.resolve("app/checkout/actions.ts"));

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [name, value] of Object.entries(values)) data.set(name, value);
  return data;
}

function redirectsTo(destination: string) {
  return (error: unknown) => {
    assert.ok(error instanceof Error && "digest" in error);
    assert.match(String(error.digest), /NEXT_REDIRECT/);
    assert.ok(String(error.digest).includes(`;${destination};`));
    return true;
  };
}

test("complete, cancel and repeat actions redirect to explicitly simulated states", async () => {
  for (const action of ["complete", "cancel", "complete"]) {
    const status = action === "cancel" ? "cancelled" : "completed";
    await assert.rejects(
      () => finishSimulation(form({ variantId: "classic-meme-tee-s-black", quantity: "2", action })),
      redirectsTo(`/orders?variantId=classic-meme-tee-s-black&quantity=2&status=${status}`),
    );
  }
});

test("tampered actions, variants, unavailable stock and quantities never produce confirmation", async () => {
  const valid = { variantId: "classic-meme-tee-s-black", quantity: "1", action: "complete" };
  for (const values of [
    { ...valid, action: "paid" },
    { ...valid, variantId: "missing" },
    { ...valid, variantId: "limited-drop-hoodie-l-grey" },
    { ...valid, quantity: "1.5" },
    { ...valid, quantity: "-1" },
    { ...valid, quantity: "11" },
  ]) {
    await assert.rejects(() => finishSimulation(form(values)), redirectsTo("/checkout?error=invalid"));
  }
});
