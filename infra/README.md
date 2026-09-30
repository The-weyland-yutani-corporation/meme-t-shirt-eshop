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
