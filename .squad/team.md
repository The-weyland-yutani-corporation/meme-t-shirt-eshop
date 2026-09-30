# Squad Team

Descriptive naming mode: agents are named after their function, not a fictional universe.

## Coordinator

- **Squad** — routes repository work to the active team via `.github/agents/squad.agent.md`.

## Members

| Name | Role | Charter path | Status |
| --- | --- | --- | --- |
| Lead | Squad Lead | `.squad/agents/lead/charter.md` | active |
| Storefront Engineer | Application Engineer | `.squad/agents/storefront/charter.md` | active |
| Platform Engineer | DevOps/Platform Engineer | `.squad/agents/platform/charter.md` | active |
| Automation Engineer | Agentic Workflows Engineer | `.squad/agents/automation/charter.md` | active |
| Quality Engineer | Test Engineer | `.squad/agents/quality/charter.md` | active |

## Coding Agent

- **@copilot** — `copilot-auto-assign: false`

## Built-in Support Agents

Mandatory, always-on support agents. They are not Cast specialists and never appear as routing destinations.

- **Scribe** — `.squad/agents/scribe/charter.md` — silently logs sessions and merges decisions in the background.
- **Ralph** — `.squad/agents/ralph/charter.md` — monitors the work queue on request.
- **Rai** — `.squad/agents/rai/charter.md` — reviews for RAI/content-safety concerns.
- **Fact Checker** — `.squad/agents/fact-checker/charter.md` — verifies claims and offers Devil's-Advocate review.
