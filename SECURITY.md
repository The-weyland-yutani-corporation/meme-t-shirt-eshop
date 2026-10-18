# Security policy

## Report privately

Do not post vulnerabilities, secrets, exploit payloads, or customer information
in public issues or discussions.

Use this repository's **Security → Advisories → Report a vulnerability** private
reporting flow if the owner has enabled it. If that option is unavailable, use
an owner-approved private maintainer channel; obtain that channel through an
existing trusted contact before sending sensitive details. This document does
not assert that private reporting is enabled or invent a security email address.

Include the affected commit/version, impact, minimal synthetic reproduction,
and sanitized logs. Do not send live keys, customer records, or real payment
details. If a credential is exposed, revoke/rotate it immediately and notify
the responsible owner privately; removing it from the latest file is not enough.

## Demonstration boundary

The default experience is a synthetic, credential-free checkout simulation,
not a production payment or fulfillment system. Treat browser inputs as
untrusted; catalog prices and availability must be resolved on the server.
The separate legacy Stripe API must remain explicitly sandbox-only and disabled
without approved configuration. Never use live keys in a workshop.

Simulation outcomes are stateless and URL-described, not authenticated records.
Anyone can edit a valid `/orders` URL to recreate completed/cancelled output.
The deterministic reference is not a secret or proof of payment; totals and
availability are re-evaluated against the current catalog, and stock is not
reserved. No cart/order persistence exists. Cookies concern consent only.
Query parameters may remain in history, access logs, telemetry, and screenshots;
never put personal information or credentials in them.

The separate `POST /api/checkout` requires `STRIPE_SANDBOX_ENABLED=true`, a
`STRIPE_SECRET_KEY` matching the accepted `sk_test_` test-key format, and a matching
same-origin `Origin` header. Its request validation and return-URL allowlist are
documented in [setup](docs/setup.md); enabling it makes Stripe test-service calls
and is not part of the default simulation.

Do not introduce PII, credentials, customer artwork, or external-service
connections for realism. Optional telemetry must not contain cart/customer
payloads, tokens, or secrets. Review retention and access before enabling it.

No supported-version matrix, response-time commitment, or security certification
is established here. Production use requires a separately approved security
review and operational ownership. See [readiness](docs/readiness.md).
