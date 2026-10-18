# Readiness and submission gates

This is a handoff checklist, **not** a certification, production approval, or
claim of Catalog acceptance. See the [capture and validation record](assets/README.md)
for implemented behavior and remaining evidence gaps.

## Accelerator readiness summary

| Item | Current assessment |
| --- | --- |
| Build | Meme Merch: Azure Storefront Accelerator |
| Repository | https://github.com/The-weyland-yutani-corporation/meme-t-shirt-eshop |
| Customer/account | Reusable across brands, retailers, and merchandise programs |
| Industry | Retail and consumer goods |
| Primary persona | Commerce product owner; developer/platform engineer |
| Desired readiness | Catalog-ready |
| Current rating | **3/5 — local demo candidate**, up from the inspected prototype; not an official Microsoft rating |

The connected simulation, local artwork, catalog wiring, documentation, and
desktop/mobile captures are delivered. **Top three fixes before sharing externally:**

1. Obtain owner-approved license/artwork terms, named support ownership, and
   authorized Catalog requirements; validate metadata against those requirements.
2. Complete independent presenter/keyboard rehearsal and a full captioned
   recording; exercise Azure/provider integration only if included in the claim.
3. Resolve or formally accept the existing developer-toolchain audit findings
   and obtain a successful security/release review.

## Demonstration acceptance

- [x] Record successful existing lint, typecheck, test, and
  build results in the asset manifest; application tests include server authority.
- [x] Exercise the default journey with no Stripe, Printful, or Azure
  credentials and no payment or fulfillment calls.
- [x] Capture local artwork, variant selection, quantity changes, server-priced
  review, unavailable-variant rejection, cancellation, simulated completion,
  confirmation, and order-status behavior.
- [x] Confirm the captured flow has no PII collection, payment collection, or
  unsupported persistence/fulfillment claims.
- [x] Reconcile the documented `/catalog` → `/checkout` → `/orders` contract,
  tee quantity-2 USD 49.98 baseline, and explicit sandbox settings against the
  implementation. Source reconciliation is not independent rehearsal evidence.
- [ ] Confirm presenters disclose editable outcome URLs, deterministic references,
  current-catalog revalidation, and the absence of persistent cart/orders,
  stock reservation, or authenticated payment proof.
- [ ] Have an operator other than the implementer rehearse both demo scripts
  from a clean checkout/session and record failures and recovery.
- [x] Populate the [asset manifest](assets/README.md) with real sanitized,
  source-fingerprinted desktop/mobile captures and the architecture diagram.
- [ ] Approve reuse permissions and record the full captioned video.
- [ ] Review keyboard navigation, focus, labels, error presentation, contrast,
  and representative viewport behavior; automated checks alone are insufficient.

**Still unverified:** independent rehearsal, full captioned video, manual
assistive-technology review, and Azure deployment. The application implementer
ran the existing checks; see exact results and limitations in the asset manifest.

## Reusability assessment

| Reuse as | Reusable component | Required customization / boundary |
| --- | --- | --- |
| Sample data | Validated JSON catalog and deterministic available/unavailable variants | Brand, prices, regions, currency, rights-cleared art; rebuild after edits |
| Architecture pattern | Provider isolation and contract tests | Real account identifiers, inventory authority, shipping and provider error rules |
| Demo template | Credential-free selection/review/outcome and captioned screenshot pack | Customer hypothesis, terminology, acceptance criteria; no payment claims |
| Integration example | Signed Stripe test webhooks and server-priced sandbox sessions | Durable event/order processing and reconciliation before any real commerce |
| Deployment pattern | Bicep, staging verification, exact-SHA health, rollback | Subscription, OIDC, RBAC, approvals, costs, retention, teardown |
| Workflow | Existing CI and immutable Squad integrity checks | Review environment permissions; preserve source/lock pairing and generated-file rules |
| Workshop template | Pilot charter, discovery questions, go/no-go criteria in demo guide | Sponsor, technical owner, baseline, measurable target and review date |

Anonymize account/tenant identifiers, customer records, browser profiles,
operational URLs, recordings, and logs before reuse. Use synthetic catalog and
order scenarios, not redacted production exports. Original artwork and
anonymization do not themselves grant redistribution rights.

## Legal, security, and operational ownership

- [ ] Obtain explicit owner approval of licensing and redistribution terms.
  No repository LICENSE is introduced by this work; public visibility is not
  blanket permission to redistribute code or assets.
- [ ] Establish artwork provenance and permission, including original SVGs,
  product names, logos, and any reused workshop media. Original artwork still
  needs owner-approved reuse terms.
- [ ] Approve a private vulnerability-reporting channel and confirm whether
  GitHub private vulnerability reporting is enabled; see [security](../SECURITY.md).
- [ ] Name a support/pilot owner, response expectations, and escalation route;
  [support guidance](../SUPPORT.md) is not an SLA or maintainer promise.
- [ ] Complete security/privacy review before introducing identity, PII,
  durable orders, live payments, fulfillment, or external telemetry.
- [ ] Resolve or formally accept the developer-toolchain audit findings and
  record a fresh dependency audit against the final commit. At implementation
  handoff, `npm audit --omit=dev` reported zero vulnerabilities, but full
  `npm audit` reported five high-severity findings in the existing lint chain
  (`braces` → `micromatch` → `fast-glob` → `@next/eslint-plugin-next` →
  `eslint-config-next`, GHSA-vfj7-8cjw-p6xm). The proposed force fix would
  downgrade `eslint-config-next` to 14.2.35 and was not applied. Do not describe
  the full dependency audit as clean or perform an unreviewed breaking downgrade.
- [ ] If Azure is in scope, approve budget, region, OIDC trust/RBAC,
  environments/reviewers, retention, rollback, and teardown ownership; record an
  actual preflight/deployment outcome. Otherwise state “local-only, not deployed.”
- [ ] Keep strict CI, protected-path/provenance, kill switches, approvals, and
  generated-workflow integrity intact.

## Catalog submission: blocked on authoritative access

The attempted Catalog MCP lookup returned **404**. Browser access redirected to
**Microsoft enterprise SSO**. Neither result verifies the Catalog schema or
required submission metadata. Do not invent required fields, enums, eligibility,
asset dimensions, or acceptance criteria from those failures.

- [ ] Obtain authorized Catalog documentation/access through an approved owner.
- [ ] Retrieve and record the authoritative schema/version and submission rules.
- [ ] Map the final accelerator metadata and evidence to each required field;
  validate using the authorized Catalog process.
- [ ] Resolve license/artwork redistribution, support ownership, and all required
  evidence before requesting human submission approval.
- [ ] Record the actual submission/validation outcome; do not claim listing or
  acceptance without it.

**Submission remains blocked** until these steps are evidenced. A locally
validated metadata file is not proof of Catalog schema compliance.

## Evidence record

For each gate, record owner, date, commit, command or manual procedure, expected
and actual result, evidence link, and unresolved risk. Distinguish **passed**,
**failed**, **not run**, and **blocked**. Keep sanitized screenshots/recordings
in the [asset manifest](assets/README.md), not secrets or customer data.
Close gates only on evidence and an explicit owner decision.

- 2026-10-18 — Deploy Azure App Service run `39159556803` was cancelled by a
  benign concurrency-group supersession from a subsequent commit's deploy run;
  the next run succeeded within ~1 minute and no recurrence was observed. See
  [incident record](incidents/2026-10-18-deploy-azure-app-service-cancellation.md)
  for the full timeline and the one caveat (job-level logs were not retrievable
  to directly confirm the cancelling actor).
