# Repository guidance

- Use Node.js 22 and npm with the committed lockfile. Existing checks:
  `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`;
  deployment changes also have `npm run test:deployment`.
- Keep changes focused and validate the behavior changed. Documentation-only
  edits do not require application tests. Never report checks as passed unless
  actually run successfully on the relevant revision.
- Preserve the credential-free synthetic storefront journey. Do not collect PII
  or make payment/fulfillment calls from the default demo.
- Resolve price and availability from the validated server catalog; never trust
  client-supplied totals, arbitrary product metadata, or availability.
- Keep the separate legacy Stripe API explicitly opt-in, test-key-only, and
  server-priced. Printful is not a connected production fulfillment service.
- Preserve the actual single-variant `/checkout` GET review and stateless
  `/orders` outcome contract. URLs are editable, references deterministic, and
  values re-evaluated against the current catalog. Do not claim persistent carts,
  saved orders, reserved inventory, or authenticated payment proof. Reset is a
  new selection from `/catalog`; cookies concern consent only.
- Sandbox calls require `STRIPE_SANDBOX_ENABLED=true` and an approved
  `STRIPE_SECRET_KEY` test key; leave both unset for the normal demonstration.
- Customize samples through `lib/catalog/content/catalog.config.json`; preserve
  valid IDs, references, integer minor-unit prices, and local asset references.
  Use original or explicitly approved artwork and fictional data.
- Do not add secrets, live credentials, private/customer data, or unsupported
  licensing claims. Follow `SECURITY.md` for private reporting.
- Never weaken CI, protected-path/provenance checks, environment approvals, or
  kill switches to make a change merge or deploy. Treat generated immutable
  workflow artifacts as generated outputs, not hand-editable source. Use the
  repository's pinned compiler and review process for intentional workflow work.
- Azure provisioning is manual and operator-owned. Do not provision resources,
  change OIDC/RBAC, enable deployment, or remove resources implicitly.
- Read `docs/architecture.md`, `docs/setup.md`, `docs/demo.md`, and
  `docs/readiness.md` for handoff boundaries. Keep implemented behavior separate
  from proposed durable orders or external integrations.
- Preserve honest readiness status: independent rehearsal and Azure deployment
  need evidence; Catalog schema/required metadata are unverified until authorized
  access is obtained. Do not invent a LICENSE, Catalog acceptance, support SLA,
  customer outcome, or deployment success.
