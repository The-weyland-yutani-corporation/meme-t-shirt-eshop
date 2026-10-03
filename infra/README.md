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
   `AZURE_HEALTH_PATH` (default `/api/health`) and return HTTP 2xx/3xx.
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
on manual `workflow_dispatch`:

1. **Build** — builds the Next.js app and packages it as a deployable zip.
2. **Deploy to staging** — deploys the package to the `staging` slot and
   bounded-polls `AZURE_HEALTH_PATH` (12 attempts, 10s apart) on
   `AZURE_STAGING_URL`. A failing staging health check stops the pipeline
   before anything reaches production.
3. **Swap to production** — swaps `staging` into production, then
   bounded-polls `AZURE_HEALTH_PATH` on `AZURE_PRODUCTION_URL`. If production
   fails the health check, the workflow automatically swaps the slots back
   and fails the run, limiting customer exposure to a regressed revision.

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
