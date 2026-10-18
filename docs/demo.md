# Demo and customer workshop

## Positioning

**Audience:** a retail product owner, commerce engineer, and security/operations
representative evaluating a low-risk merchandise pilot.

**Opener:** “Can we agree on a believable product-to-confirmation experience
before collecting customer data or integrating payments and fulfillment?”
This demo answers that question with a credential-free simulation. It does not
demonstrate a real sale, inventory reservation, delivery, or production readiness.

## End-to-end journey

From `/`, choose **Explore the collection →** to open `/catalog`. Catalog search
and category filters use GET parameters `q` and `category`; **Apply** submits
them, **Clear filters** returns to `/catalog`, and `page` selects an eight-item
page. Choose **View design & variants →** to open a product. The baseline catalog
contains only two products, so do not imply a second results page exists.

| # | Input | Context | Workflow | Expected output | Next action |
| --- | --- | --- | --- | --- | --- |
| 1 | Open `/catalog` | Synthetic catalog; no provider credentials | Open Limited Drop Hoodie, then Classic Meme Tee | Hoodie Grey / L (USD 54.99) is unavailable; tee Black / S is USD 24.99 with local artwork | Select Black / S |
| 2 | Enter quantity `2` on `/catalog/classic-meme-tee` | Single variant; quantity 1–10; no persistent cart | Choose **Review simulated purchase** | GET `/checkout?variantId=classic-meme-tee-s-black&quantity=2` | Inspect server review |
| 3 | Variant ID and quantity | Catalog is the server's authority | Inspect **Review your demo cart** (a single-selection summary) | Unit price USD 24.99, demo total USD 49.98, charged USD 0.00; no address/card fields | Choose cancellation first |
| 4 | **Cancel simulation** | Selection is revalidated; no provider calls | Redirect to `/orders?variantId=classic-meme-tee-s-black&quantity=2&status=cancelled` | **Simulation cancelled**, “cancelled — no order created,” charged USD 0.00 | Return to catalog and review the same selection |
| 5 | **Complete simulated purchase** | Selection is revalidated again | Redirect to `/orders?variantId=classic-meme-tee-s-black&quantity=2&status=completed` | **Simulated purchase complete**, deterministic `SIM-` reference, “simulated — not sent for fulfillment,” charged USD 0.00 | Explain synthetic status |
| 6 | **Browse and simulate again** | No stored order or reserved inventory | Return to `/catalog` and make a new selection | No checkout state requires deletion | Agree a pilot or record gaps |

The URL describes the outcome and can be edited to recreate it; it is not
payment proof or an order lookup. Identical inputs/current prices yield the same
reference. Catalog updates may change totals/references or invalidate links.
Never add personal information to URLs: history, logs, and shared captures may
retain them. Cookies cover consent only, not cart/order persistence.

## Preparation and expected baseline

- Follow [setup](setup.md), select a reviewed commit, and open a clean browser
  profile. Leave external-service credentials unset.
- Confirm the baseline tee/hoodie labels, availability, and prices above still
  match the reviewed catalog. If customized, update the script and evidence
  before presenting; do not improvise.
- Close unrelated tabs, notifications, terminals, and account panels before
  capture. Do not expose signed-in identities, tenant IDs, or secrets.
- Confirm local images render and the six-step journey above works. Check
  `/api/health` for HTTP 2xx and `status: "ok"` if diagnosing server readiness;
  local `deploymentSha` may be `"unknown"`. Health alone is not a demo pass.
- Prepare the reviewed [asset manifest and captures](assets/README.md). These
  include implementation-agent captures, not an independent rehearsal.

## Five-minute demonstration

| Time | Presenter action | Exact expectation / narration |
| --- | --- | --- |
| 0:00–0:40 | State the customer question and boundary | “Synthetic data, no credentials, no payment or fulfillment calls.” |
| 0:40–1:40 | Browse; show unavailable and available variants | Unavailable selection is blocked; available selection shows matching local art and catalog price. |
| 1:40–2:40 | Select tee Black / S, quantity 2; review | USD 24.99 each, USD 49.98 total, USD 0.00 charged. No PII or card fields. |
| 2:40–3:15 | Cancel, then return to catalog and review again | Cancelled status says no order created; a new selection remains possible. |
| 3:15–4:15 | Complete simulation and inspect status | Confirmation/status are visibly synthetic, not paid or fulfilled. |
| 4:15–5:00 | Show boundary diagram and readiness gates | Ask for a time-boxed pilot decision, not production approval. |

## Fifteen-minute demonstration

| Time | Presenter action | Expected result |
| --- | --- | --- |
| 0:00–2:00 | Opener and discovery | Agree whose workflow is being validated and which decision the demo supports. |
| 2:00–7:00 | Run the five-minute journey | Selection, availability, authoritative review, cancel, completion, and status all match the numbered journey. |
| 7:00–9:00 | Inspect catalog configuration and local artwork | Show editable minor-unit price/availability and reviewed assets; no live provider linkage is implied. Avoid editing code live. |
| 9:00–11:00 | Explain the architecture diagram | Distinguish working simulation from opt-in Stripe sandbox, disconnected Printful, and proposed durable orders. |
| 11:00–13:00 | Discuss security, privacy, and deployment ownership | No customer data; Azure resources and OIDC are operator-owned and billable. Rehearsal/deployment are not assumed verified. |
| 13:00–15:00 | Fill a pilot charter and CTA | Name an owner, measurable acceptance criteria, a review date, and a go/no-go decision. |

## Reset and fallback

1. Choose **Browse and simulate again** on `/orders`, or navigate directly to
   `/catalog`. Open the tee and enter the desired variant/quantity again.
2. There is no cart or stored order to clear. Cookies only concern consent;
   clearing site storage is not a checkout reset. Use a clean browser profile
   only when separately rehearsing the initial consent experience.
3. Restore approved sample configuration if it was edited; restart development
   or rebuild and restart a local production build. Hosted changes require the
   normal reviewed rebuild/deployment. Old `/orders` URLs reconstruct against
   that current catalog; revisiting one does not prove a previous order persisted
   or was deleted.
4. If review fails, return to `/catalog`, choose an available variant with a
   whole-number quantity from 1–10, and retry once. Capture a sanitized error if
   it still fails. Do not enable Stripe, add credentials, or use real transactions.
5. If the live journey still fails, use only reviewed, commit-labelled captures
   from the asset manifest and disclose that it is a recording/walkthrough.
   If captures are missing, use [the diagram](architecture.md) and mark the live
   demo incomplete. Do not fabricate success or an Azure-hosted fallback.

## Discovery, pilot, and next action

Ask: Who selects merchandise today? Where do price or availability errors occur?
What system owns catalog and orders? Which approvals govern artwork and customer
data? What does success change operationally? Which accessibility and regional
requirements apply? Who will own incidents and costs?

**Pilot charter template:** sponsor and delivery owner; one target audience and
catalog slice; agreed start/end dates; synthetic-only data boundary; exclusions
(live payment, fulfillment, PII); environment and spending cap; acceptance
criteria; evidence owner; and a dated go/no-go review. A real integration is a
new scope requiring security, legal, and operational approval.

**Suggested success criteria to agree, not claimed results:** an independent
operator completes all six steps from a clean session; unavailable selections
are rejected; review totals match approved catalog data; cancellation creates
no success claim; captures contain no PII/secrets; pilot owners accept documented
integration gaps. Record actual outcomes and failures, not just attendance.

**CTA:** schedule the charter review with a named sponsor and engineering owner.
Choose either a bounded synthetic pilot, separately scoped integration
discovery, or a stop decision. Do not substitute a demo for launch approval.

## Reusable assets

The [asset manifest](assets/README.md) indexes actual desktop/mobile storefront,
review/cancel, confirmation/status captures and the architecture diagram.
The captioned HTML screenshot walkthrough is a backup, not a video recording.
A full-length captioned journey recording remains open. Each entry needs a relative
path, capture date, source commit, owner, purpose, rights/consent status, and
whether it is captured or still planned.

Use fictional products and original/approved artwork. Crop or replace account
names, faces, customer identifiers, tenant/subscription identifiers, browser
profiles, internal URLs, and secrets before reuse. Check image metadata,
recording audio, terminal history, and alt text as well as visible pixels.
Anonymization does not grant redistribution rights; obtain owner approval before
external sharing. See [readiness](readiness.md) for outstanding gates.
