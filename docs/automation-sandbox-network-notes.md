# Automation sandbox network notes: Actions jobs API access

This note documents a reproducible network limitation observed in the
agentic-workflow research sandbox (the environment Squad automation runs in
via `gh-aw`), and the confirmed workaround, so future incident forensics can
reliably distinguish manual cancellations from platform-driven ones without
re-diagnosing the same TLS error.

## Symptom

`gh run view <run-id> --json jobs` fails consistently in the sandbox with:

```
Get "https://api.github.com/repos/<owner>/<repo>/actions/runs/<id>/jobs?per_page=100":
tls: failed to verify certificate: x509: certificate is not valid for any
names, but wanted to match api.github.com
```

This reproduced on 5/5 consecutive attempts against a live, in-progress run.

## Root cause

The sandbox's `gh` binary (`/run/awf-lib/gh`) is a wrapper
(`gh-cli-proxy-wrapper`) that forwards every invocation, verbatim, to a CLI
proxy sidecar (`AWF_CLI_PROXY_URL`, default `http://172.30.0.50:11000`) over
HTTP, which executes the real `gh` command server-side and relays
stdout/stderr/exit code back. Outbound HTTPS from that execution path goes
through the sandbox's `squid` MITM proxy (`HTTPS_PROXY=http://172.30.0.10:3128`),
which presents a self-signed certificate for TLS interception.

`gh run view --json jobs` paginates the `.../actions/runs/{id}/jobs` endpoint
internally using `gh`'s own HTTP client configuration for that command path.
In this sandbox, that specific code path does not pick up the proxy's CA
trust the same way the generic `gh api` request path does, so the TLS
handshake fails the hostname/CA check. This is a sandbox-local interception
quirk, not a GitHub API outage — the same endpoint is reachable moments
later through a different `gh` entry point (see workaround).

## Confirmed workaround

Use `gh api` directly against the jobs endpoint instead of `gh run view
--json jobs`. This succeeded reliably (5/5 attempts, including against the
same in-progress run that failed via `run view`):

```sh
gh api "repos/<owner>/<repo>/actions/runs/<run-id>/jobs?per_page=100"
# or, for a run with more than 100 jobs:
gh api --paginate "repos/<owner>/<repo>/actions/runs/<run-id>/jobs?per_page=100"
```

Both forms returned complete job lists (including per-step status, timing,
and conclusion) with no TLS error in every trial.

## Guidance for incident forensics

When investigating a workflow run cancellation or failure in this sandbox:

1. Prefer `gh api repos/<owner>/<repo>/actions/runs/<run-id>/jobs` (optionally
   with `--paginate`) over `gh run view --json jobs` to retrieve job/step
   detail. The `--paginate` form is required only when a run has more than
   100 jobs.
2. `gh run view <run-id>` (without `--json jobs`) and other `gh api` calls
   (e.g. `gh api repos/.../actions/runs/<run-id>`) are unaffected and can be
   used normally for run-level metadata (status, conclusion, actor,
   triggering event) to distinguish a manually cancelled run from one
   superseded or stopped by platform/concurrency controls.
3. If a future `gh` CLI or proxy upgrade changes this behavior, re-verify
   with a quick repeated-attempt check (as above) before relying on `gh run
   view --json jobs` again in this sandbox.

This is scoped to the research/automation sandbox's network policy and does
not affect the storefront application or its CI.
