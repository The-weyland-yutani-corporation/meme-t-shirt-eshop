# Azure App Service deployment

This operator-run scaffold creates a Linux App Service plan and app, a
`staging` deployment slot, a workspace-based Application Insights resource,
and a Log Analytics workspace. The autonomous deployment workflow does not
run this template or create billing-bearing infrastructure. The template
intentionally creates no credentials, role assignments, federated identities,
DNS, or application secrets.

## Operator prerequisites

1. Create the target resource group and a Microsoft Entra application or
   user-assigned managed identity with a GitHub Actions federated credential.
2. Grant that identity the minimum deployment and slot-swap permissions needed
   on the target resource group. Keep this access setup outside this template.
3. Create GitHub environments named `staging` and `production`. Add required
   reviewers to `production` if approval before a swap is desired.
4. Ensure CI has a workflow whose top-level `name` is `CI`, or update
   `workflows: [CI]` in `.github/workflows/deploy.yml`.
5. The application must expose an unauthenticated health endpoint matching
   `AZURE_HEALTH_PATH` (default `/api/health`). It must return HTTP 2xx with
   JSON containing `status: "ok"` and the running `deploymentSha`.
6. Deploy `infra/main.bicep` manually after reviewing the SKU and expected
   cost. Record its production and staging URLs as repository variables.

## Repository configuration

Repository **variables**:

- `AZURE_RESOURCE_GROUP` — existing resource group name.
- `AZURE_APP_NAME` — globally unique App Service name.
- `AZURE_HEALTH_PATH` — optional health endpoint beginning with `/`.
- `AZURE_STAGING_URL` — full HTTPS URL for the staging slot.
- `AZURE_PRODUCTION_URL` — full HTTPS URL for the production site.
- `AZURE_DEPLOY_ENABLED` — set to `true` only after infrastructure and OIDC
  configuration are complete; any other value keeps deployment disabled.

Repository **secrets** (values are identifiers, not client credentials):

- `AZURE_CLIENT_ID` — client/application ID used by GitHub OIDC.
- `AZURE_TENANT_ID` — Microsoft Entra tenant ID.
- `AZURE_SUBSCRIPTION_ID` — Azure subscription ID.

No publish profile or long-lived Azure client secret is required. After an
operator provisions the reviewed Bicep template, the workflow deploys the
packaged app to `staging`, checks it, swaps it into production, checks
production, and swaps back if the production check regresses.

## Deployment pipeline behavior

`.github/workflows/deploy.yml` runs after a successful `CI` run on `main`, or
on manual `workflow_dispatch`. Manual runs require the exact current `main`
SHA and default to a non-deploying `preflight` operation. Both triggers fail
closed if that SHA is malformed, comes from another repository, or is no
longer the current `main` head.

1. **Resolve and build** — validates the exact current deployment SHA, builds
   that revision, and packages either Next.js standalone output or the
   repository's standard `.next` output with pruned production dependencies.
   Deploy operations also create a queued GitHub deployment record; preflight
   does not request deployment permission.
2. **Inspect and deploy staging** — validates the current production health
   identity. An idempotent rerun exits successfully without deploying or
   swapping when production already serves the requested SHA. Otherwise the
   package is deployed to `staging` and `DEPLOYMENT_SHA` is configured there.
3. **Verify before swap** — bounded-polls staging and requires JSON
   `status=ok` with the exact expected SHA. A failure stops before any swap.
   Sanitized production/staging state is captured as a retained artifact.
4. **Swap and verify production** — performs one production swap and applies
   the same exact-SHA health validation to production.
5. **Rollback once** — if production verification fails, performs exactly one
   swap-back and verifies the previously captured production SHA or restores
   the same non-2xx first-deployment state. Rollback command or verification
   failures are surfaced explicitly.
6. **Record evidence** — publishes queued, in-progress, and final GitHub
   deployment statuses. Failure/error statuses are durable inputs for
   `factory-signal-intake`.

The manual `preflight` operation remains available while
`AZURE_DEPLOY_ENABLED` is disabled. It builds and downloads the package,
authenticates through the `staging` environment's OIDC identity, verifies
read access to the app and staging slot without logging app-setting values,
and validates that both configured health URLs have valid HTTPS syntax and
complete a DNS/TLS/network request. Any completed HTTP response, including an
expected first-deployment `404`, proves reachability; preflight does not
require an application health payload before the first deployment. It never
deploys a package, changes an app setting, creates a production deployment
record, or swaps slots. Manual `deploy` and all `workflow_run` deployments
still require the kill switch and retain strict HTTP-success JSON checks for
`status=ok` with the exact deployment SHA.

The deploy operation's initial production inspection also accepts any
completed non-2xx response as a not-yet-deployed state, so a first deployment
can proceed. A 2xx response remains strict: it must contain valid JSON with
`status=ok`, and deployment is skipped only when `deploymentSha` exactly
matches the selected SHA. URL configuration and DNS/TLS/network/timeout
failures remain fatal.

Protected-path policy (`.github/scripts/protected-path-policy.mjs`) and the
autonomous-merge provenance gate (`.github/scripts/autonomous-merge-gate.mjs`)
run as part of CI on every pull request, including changes to this deployment
pipeline and infrastructure template — they require current-head Squad review
and a valid implementation marker before an autonomous pull request can merge
to `main`. Nothing in this deployment template or workflow bypasses those
gates.

## Kill switches

- `AZURE_DEPLOY_ENABLED` — the primary kill switch for this pipeline. Set to
  any value other than exactly `true` (for example, unset or `false`) to
  disable both the `workflow_run` and manual `workflow_dispatch` triggers;
  the `build` job's `if:` condition short-circuits the entire workflow before
  any Azure call is made.
- `FACTORY_ALLOW_MERGE` / `FACTORY_KILL_SWITCH` — repository variables that
  gate the separate autonomous merge workflow
  (`.github/workflows/autonomous-merge-gate.yml`). These control whether
  Squad-authored pull requests (including changes to this deployment
  pipeline) are auto-merged to `main`; they do not disable the deploy
  workflow itself. See `.github/workflows/factory-controller.md` for their
  exact semantics.
- Removing the `production` GitHub environment's required reviewers is an
  operator action, not a kill switch; keeping reviewers configured adds a
  manual approval gate before the production swap step runs.

## Operator-owned prerequisites (recap)

All configuration above — the resource group, managed identity and federated
credential, GitHub environments, repository variables/secrets, and the
reviewed Bicep deployment — is operator-owned per the "Operator prerequisites"
section above. The autonomous workflow never creates or modifies any of it.

## Accelerator demonstration: scope and verification

The [local simulated checkout](../docs/demo.md) needs no Azure resources,
payment-provider credentials, or fulfillment connection. Prefer local setup for
a workshop. The existence of this template and pipeline is not evidence that
the accelerator has been deployed or independently rehearsed on Azure; both
remain unverified until an operator records results for a specific commit.

For the default demo, leave `STRIPE_SANDBOX_ENABLED` and `STRIPE_SECRET_KEY`
unset in both production and staging. The independent `POST /api/checkout` API
only enables with `STRIPE_SANDBOX_ENABLED=true` and a valid `sk_test_` test key;
it then makes Stripe test-service calls. It is not a deployment prerequisite or
fallback. If separately approved, configure test secrets privately through the
operator's secret-management process, review slot-specific settings and swap
behavior, and never add key values to Bicep, logs, or source control. See
[the validated request contract](../docs/setup.md).

The demonstration itself uses `/catalog` → `/checkout` → `/orders`: one variant
and quantity are URL-described, with no persistent cart or stored order.
Outcome URLs are editable and references deterministic; current catalog values
are resolved again, and no stock is reserved. Configure access/telemetry policies
accordingly: even synthetic selection URLs can appear in logs and browser
history, and no PII or credentials belong in query parameters.

Provisioning is manual, never an automatic accelerator setup step. After the
prerequisites above are reviewed, an operator may inspect the proposed changes
and deploy the existing template using Azure CLI:

```sh
az account show --query '{subscription:name,id:id}' --output table
az deployment group what-if \
  --resource-group <reviewed-dedicated-resource-group> \
  --template-file infra/main.bicep \
  --parameters appName=<globally-unique-app-name> appServicePlanSku=S1
az deployment group create \
  --resource-group <reviewed-dedicated-resource-group> \
  --template-file infra/main.bicep \
  --parameters appName=<globally-unique-app-name> appServicePlanSku=S1
```

Replace placeholders only after confirming the intended subscription, dedicated
resource group, region, naming, and budget. The resource group must already
exist. `what-if` previews changes; `create` provisions billable resources.
Neither command establishes GitHub OIDC trust, RBAC, environment reviewers, or
repository settings. Review those separately, including federated issuer,
audience, environment-bound subject, and least-privilege scope. Keep preflight,
exact-SHA health checks, approvals, rollback, protected-path/provenance gates,
and generated immutable workflow controls intact.

## Cost and telemetry review

- The App Service plan is billable while provisioned, even with no workshop
  traffic; stopping the web app does not remove the plan's charges.
- Staging slots consume plan capacity. Review current SKU slot allowances,
  capacity, and any additional service charges rather than assuming the
  staging environment is free.
- Application Insights and Log Analytics can incur ingestion, retention, and
  query-related charges. The template sets workspace retention to 30 days;
  review current pricing, limits, sampling, budgets, and alerts with the cost
  owner. There is no fixed-price or zero-cost promise.
- Review both production and staging telemetry, access, and retention before
  enabling collection. Send only approved operational signals; never record
  customer/cart payloads, addresses, payment details, tokens, or secrets.
  Synthetic data and deployment identifiers can still reveal operational
  context. Local telemetry is unnecessary for the demo.

## Operator-owned teardown

1. Disable deployment via `AZURE_DEPLOY_ENABLED` and confirm no deployment is
   running. Record any evidence needed for the approved retention period.
2. Review the selected subscription and **every resource** in the dedicated
   resource group. Confirm it contains no shared or unrelated services:

   ```sh
   az resource list --resource-group <reviewed-dedicated-resource-group> --output table
   ```

3. Only after explicit owner approval, delete that dedicated resource group:

   ```sh
   az group delete --name <reviewed-dedicated-resource-group>
   ```

   This is destructive and is intentionally not automated or passed `--yes`.
   Do not use group deletion for a shared environment; obtain a reviewed
   resource-specific removal plan instead.
4. Verify deletion has completed and review remaining billable resources and
   retained logs. Remove only dedicated, approved federated credentials/RBAC
   assignments and stale repository configuration; do not remove shared
   identities. Confirm final costs with the subscription owner.
