# Setup and customization

## Credential-free local run

Prerequisites: Git, Node.js **22**, npm, and a checkout of this repository.
No Azure subscription, Stripe key, Printful account, or external catalog access
is required for the simulated journey.

```sh
node --version
npm --version
npm ci
npm run dev
```

Open `http://localhost:3000`, then `/catalog`. Confirm the page identifies the experience as a
simulation. Use only the synthetic catalog; never enter real customer or card
details. Leave payment-provider and telemetry settings unset for a local demo.
Stop the local server with Ctrl+C when finished.

For a production-mode local rehearsal, stop the development server first:

```sh
npm run build
npm run start
```

`build` also runs the existing postbuild performance-budget check. If the port
is already in use, stop the server you started rather than terminating unrelated
processes. Record any alternate port in rehearsal evidence.

## Existing validation

Run these when changing application code or sample configuration:

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

These are existing repository commands, not evidence that they have passed on
your checkout. CI also verifies deployment packaging, strict compiled-workflow
freshness, Squad installation integrity, and protected-path/provenance controls.
For deployment code changes, the existing targeted command is
`npm run test:deployment`. Documentation-only edits do not require app tests.
Do not bypass CI gates or manually edit generated immutable workflow artifacts.

## Customize a synthetic sample

1. Edit `lib/catalog/content/catalog.config.json` in a branch. Use fictional
   product names and descriptions and keep category, tag, product, and variant
   IDs unique and cross-references consistent.
2. As a small exercise, change one variant's `priceCents` from `2499` to `2999`
   (USD 29.99 when `currency` is `USD`) and set another variant's `isAvailable`
   to `false`. Keep prices non-negative integer minor units and the variant's
   `productId` equal to its containing product ID. Do not paste provider secrets
   into `providerVariantId`; sample identifiers are not credentials.
3. Use original or explicitly cleared local artwork. Update the product's
   `images` references to the corresponding public asset URL; confirm every
   referenced asset renders. Never substitute scraped meme art or customer logos
   without permission.
4. Run the existing checks above. Restart local development after configuration
   changes; production-mode changes require a new build and restart, or a
   reviewed rebuild/redeployment for a hosted app.
   Verify the displayed price and server-reviewed total reflect the edited
   catalog and the unavailable variant cannot proceed to review.
5. Review the diff and submit through normal repository review. Restore the
   approved sample configuration before presenting the standard demo.

Catalog validation is not a rights review, inventory service, tax calculator,
or currency-conversion service. The simulation reviews one variant at a time;
the separate sandbox API rejects mixed-currency line items.

## Optional integration and deployment

The simulation is single-variant, not a persistent cart. The default sample is
**Classic Meme Tee → Black / S**, USD 24.99; quantity **2** produces USD **49.98**
on `/checkout?variantId=classic-meme-tee-s-black&quantity=2`, with USD **0.00**
charged. **Limited Drop Hoodie → Grey / L**, USD 54.99, is unavailable.
Completion/cancellation redirects to `/orders` with the selection and status
in the URL. Return to `/catalog` to start again; no cart/site-storage reset is
needed. Order URLs are editable, reproducible descriptions, not saved orders;
they always use current prices/availability.

The legacy `POST /api/checkout` endpoint is not required by the simulation.
It remains disabled unless both `STRIPE_SANDBOX_ENABLED=true` and
`STRIPE_SECRET_KEY` containing an actual `sk_test_` key are configured in a
private environment. Never commit the key, enable live payments, or turn this on
as a demo fallback. A running server may need a restart after changing settings.
The API requires a matching same-origin `Origin` header and this JSON shape:

```json
{
  "lineItems": [
    { "variantId": "classic-meme-tee-s-black", "quantity": 2 }
  ],
  "successUrl": "/orders",
  "cancelUrl": "/catalog"
}
```

This is a contract example, not a request to execute. Allow 1–10 line items;
each quantity must be a numeric integer from 1–10. Optional item `amount` and
lowercase `currency` must match current catalog values. Prices and product names
come from the server; unavailable items and mixed currencies are rejected.
Return URLs allow only same-origin `/checkout`, `/catalog`, or `/orders` with
no query/fragment. A bare `/orders` return is not a valid simulated outcome and
shows the no-valid-selection state; Stripe success is not bridged into the
simulation. Session creation returns an ID and URL, not proof of payment.
Printful remains disconnected.

Azure is optional and has **not been deployment-verified for this handoff**.
Follow [operator prerequisites and cost/teardown guidance](../infra/README.md)
before provisioning anything. Do not enable deployment merely to run locally.

## Rehearsal handoff

Use [the numbered journey and reset procedure](demo.md). An independent operator
must record the commit, Node version, commands/results, screenshots, and any
deviations in the [asset manifest](assets/README.md) before readiness is claimed.
The manifest contains implementation-agent captures and test results, not an
independent rehearsal; missing independent evidence remains a blocker.
