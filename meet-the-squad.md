# Meet the Squad

**Naming mode:** Descriptive

## The Team

| Name | Role | Specialty | How to talk to them |
| --- | --- | --- | --- |
| Lead | Squad Lead | Prioritization & cross-cutting decisions | Label an issue `squad:lead` or ask a roadmap/scope question |
| Storefront Engineer | Application Engineer | Product catalog, cart, checkout, storefront build | Label an issue `squad:storefront-engineer` |
| Platform Engineer | DevOps/Platform Engineer | Azure App Service infra, CI/CD, deploy pipeline | Label an issue `squad:platform-engineer` |
| Automation Engineer | Agentic Workflows Engineer | gh-aw workflows, validators, factory automation | Label an issue `squad:automation-engineer` |
| Quality Engineer | Test Engineer | Test suites, CI health, coverage gaps | Label an issue `squad:quality-engineer` |

## How to Work With Your Squad

Assign work by adding the `squad` label (color `9B8FCC`) plus the member's slug label (also `9B8FCC`) to an issue. The Squad Coordinator (`.github/agents/squad.agent.md`) reads `.squad/routing.md` and delegates to the right specialist automatically.

- Use `/squad triage` to classify open proposals into work, decisions, and exclusions.
- Use `/squad plan` to turn accepted proposals into an implementation plan.
- Use `/squad activate` to create assignable implementation issues from an approved plan.
- See `.squad/routing.md` for the full work-type-to-specialist mapping.

## What Happened Here

This Squad was cast automatically from repository evidence:

- **Languages/stack:** Azure Bicep (`infra/main.bicep`) targeting a Node.js 22 Linux App Service; no application source has landed yet, so `ci.yml`'s application-checks job currently records a sparse-repository skip.
- **Structure:** A minimal repository containing an operator-run infrastructure scaffold (`infra/`), a pre-existing gh-aw agentic workflow stack (`.github/workflows/`), and shared JS validators/tests under `.github/workflows/shared/` and `.github/scripts/`.
- **CI/CD:** `ci.yml` runs application checks (conditional on `package.json`), gh-aw compiled-workflow freshness, Squad install integrity, and a protected-path policy gate. `deploy.yml` builds, deploys to a staging slot, health-checks, swaps to production, and rolls back on regression.
- **Rationale:** Roles were chosen to cover the concrete evidence present today (infrastructure, CI/CD, and the existing automation stack) plus the storefront application implied by the repository's name and the deploy pipeline's Next.js-shaped build steps, with Lead and Quality Engineer added as cross-cutting and quality roles.

---

_Cast on 2026-09-30._
