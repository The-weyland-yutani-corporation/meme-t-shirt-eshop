# Demo assets and release evidence

**Captured:** 2026-10-18, by the implementation agent, from a production-mode
local server at `http://127.0.0.1:3001`. No Azure deployment is evidenced.
The Playwright MCP connection was unavailable; the installed ChromeDriver and
Chromium captured actual rendered pages instead. No screenshots were fabricated.

**Source revision:** [`18720ae17ede8491eba158936e1185a544ea3c3b`](https://github.com/The-weyland-yutani-corporation/meme-t-shirt-eshop/commit/18720ae17ede8491eba158936e1185a544ea3c3b),
based on `e104596`. The runtime source fingerprint below identifies the exact
source used for capture; documentation-only follow-up commits do not change it.

- Next.js build ID: `sI-7_2eBcXcP7I8tm-Dha`.
- Node: `v22.23.3`; npm: `10.9.9`.
- Chromium: `155.0.8059.0`; ChromeDriver: `155.0.8059.39`.
- Runtime source SHA-256: `da3daa77cab51bd4df612d880e0d3dbdb4dfbcd9da43ddee69bb102cc303799d`.
- Fingerprint procedure, from the repository root:

  ```sh
  find app lib public -type f ! -path '*/__tests__/*' ! -path '*/testing/*' -print0 |
    sort -z | xargs -0 sha256sum | sha256sum
  ```

## Captured assets

Desktop captures use a 1440-pixel viewport. Mobile captures use 390-pixel device
emulation and include the full page; these are not physical-device evidence.
Optional analytics was declined in a fresh demo browser. All products and
references are synthetic; no customer, account, tenant, payment, or address data
appears. SVG illustrations and diagram were created for this implementation;
owner-approved reuse terms remain pending.

| Asset | Purpose and observed state |
| --- | --- |
| [Desktop home](desktop-home.png) | Customer-facing entry, original art, simulation boundary |
| [Catalog](desktop-catalog.png) | Two sample products, local imagery, availability |
| [Search/filter](desktop-search.png) | Submitted `Classic` search and `t-shirts` category |
| [Product](desktop-product.png) | Available tee variants and quantity selection |
| [Checkout review](desktop-checkout.png) | Submitted Black/S tee, quantity 2; USD 49.98 total, USD 0 charged |
| [Cancellation](desktop-cancelled.png) | Actual **Cancel simulation** server action and redirected outcome |
| [Confirmation/status](desktop-confirmation.png) | Actual **Complete simulated purchase** action; `SIM-4DAB5DF75EF3`, no payment/shipment |
| [Unavailable stock](desktop-unavailable.png) | Grey/L hoodie intentionally unavailable |
| [Rejected selection](desktop-invalid-selection.png) | Direct review of unavailable hoodie rejected; recovery link |
| [Mobile home](mobile-home.png) | Responsive entry point |
| [Mobile product](mobile-product.png) | Full variant/quantity screen |
| [Mobile review](mobile-checkout.png) | Full simulated review screen |
| [Architecture SVG](architecture.svg) | Accessible diagram separating demo, examples, Azure pattern, and future work |
| [Captioned screenshot walkthrough](walkthrough.html) | Offline presenter backup; open the HTML file with adjacent PNGs |

The browser was navigated through the actual selection form and both server
actions, not only directly to confirmation URLs. During capture, both catalog
images loaded; the mobile home, product, and review documents had 390-pixel
content widths without horizontal document overflow. This is a bounded capture
observation, not a cross-browser or comprehensive accessibility certification.

## Existing validation executed by the application implementer

| Command/check | Observed result |
| --- | --- |
| `npm run lint` | Passed, exit 0 |
| `npm run typecheck` | Passed, exit 0 |
| `npm test` | Passed, 100 tests |
| `npm run build` | Passed, including postbuild budget |
| JavaScript budget | 134.5 KB gzip, below 180 KB |
| `npm run test:deployment` | Passed, 25 tests |
| `npm audit --omit=dev` | Exit 0; zero reported production vulnerabilities |
| `npm audit` | Exit 1; five high-severity existing development-toolchain findings |

The full audit findings are in the existing lint dependency chain:
`braces → micromatch → fast-glob → @next/eslint-plugin-next → eslint-config-next`,
advisory [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).
No package versions were changed. The proposed forced fix downgraded the lint
configuration incompatibly and was not applied. Track a compatible remediation
or explicit risk decision before external release; do not describe the full
dependency audit as clean.

The implementer also exercised production HTTP completion/cancellation/repeat,
invalid input, unavailable stock, local assets, unknown-product 404, disabled
Stripe, and health behavior. Expanded existing axe tests passed. Manual
keyboard/assistive-technology and broad browser testing remain open.

### Automated release review attempt

The post-commit `parallel_validation` attempt on 2026-10-18 did **not** provide
a successful review/security scan:

- Its review wrapper reported no comments but the underlying review tool was
  unavailable because the requested model was missing from the model registry.
  Do not interpret the wrapper's “success” label as a completed code review.
- CodeQL JavaScript analysis **failed**. Zero emitted alerts from a failed
  analysis is not a clean scan.

These tooling failures remain release gates, not application-test failures.
They require a functioning review/scan environment and a rerun before sign-off.

A separate read-only code-review agent inspected `HEAD^..HEAD` at `18720ae`
and found no significant issues. It did not run tests or establish a successful
CodeQL analysis. The secret scan of all 51 changed files reported no secrets.

## Missing or approval-dependent evidence

- **Full-length captioned video:** not recorded. The HTML walkthrough is a
  screenshot backup, not a video. Use the [five-minute script](../demo.md), record
  a complete session with captions/transcript, scrub it, and add an approved
  artifact link here and to the metadata.
- **Independent presenter rehearsal:** not run. Another operator must reproduce
  setup and both demo scripts from the committed source.
- **Azure/OIDC/staging/swap/rollback:** not exercised against an Azure account.
- **Live sandbox provider round trip:** not exercised with external credentials;
  the core demonstration deliberately uses no external services.
- **Security sign-off:** local tests and dependency audit are not a completed
  security review. Automated review/CodeQL attempts were unavailable; record a
  successful review before treating that release gate as passed.
- **License/artwork approval, named support owner, and private reporting channel:**
  require repository-owner decisions; no license grant or SLA is implied.
- **Catalog schema and acceptance:** unverified; API lookup returned 404 and web
  access redirected to enterprise SSO. Obtain authorized requirements first.

See [readiness gates](../readiness.md). Keep this record truthful when replacing
assets: attach the source revision/fingerprint, browser, viewport, date, capture
owner, actual outcome, and approval status. Do not silently reuse stale captures.
