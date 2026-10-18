# Incident record: cancelled Deploy Azure App Service run

- **Run:** [`39159556803`](https://github.com/The-weyland-yutani-corporation/meme-t-shirt-eshop/actions/runs/39159556803)
- **Workflow:** `Deploy Azure App Service` (`.github/workflows/deploy.yml`)
- **Trigger:** `workflow_run` following `CI` on `main`
- **Head SHA:** `85774be5a0fc21d7a8269c4e6081a4c478259944`
- **Conclusion:** `cancelled`
- **Window:** created `2026-10-18T19:36:44Z`, completed `2026-10-18T19:39:06Z`
  (run duration ~142s)
- **Related:** closes out #77 (goal #77), scoped by #81

## Root cause assessment

`deploy.yml` serializes all deployment attempts through a single concurrency
group:

```yaml
concurrency:
  group: azure-app-service-production
  cancel-in-progress: false
```

Evidence from the Actions run history around the incident window shows a rapid
sequence of pushes to `main`, each completing a successful `CI` run and
re-triggering `Deploy Azure App Service`:

| Time (UTC) | Head SHA | CI conclusion | Deploy run | Deploy conclusion |
| --- | --- | --- | --- | --- |
| 19:35:54 | `85774be5…` | success | `39159556803` | **cancelled** |
| 19:37:50 | `078584f7…` | success | `39159735948` | success |

The deploy run for `85774be5…` was queued/running when the newer `078584f7…`
commit landed on `main` moments later. The workflow's own SHA-freshness guard
(`deployment-control.mjs` `selectDeploymentSha`) treats any deployment whose
candidate SHA no longer matches the current `main` tip as stale and rejects it
— the same “only the latest `main` SHA may deploy” invariant that the
concurrency group exists to enforce. That is consistent with a benign
supersession: the run for the older commit was pre-empted by the run for the
newer commit before either job reached the deploy step, rather than any
infrastructure failure, manual intervention, or application defect.

**Caveat (R7):** job-level step logs/annotations for run `39159556803` were not
retrievable via the available read APIs during this investigation (0 jobs
returned), so the precise cancelling actor (GitHub Actions concurrency
scheduling vs. an external cancel call) could not be directly confirmed from
step logs. The timeline correlation with the immediately following commit and
the workflow's documented SHA-staleness behavior are the basis for the "benign
supersession" conclusion; this is not a byte-for-byte confirmed trace.

## Recovery evidence

The next `Deploy Azure App Service` run (`39159735948`, for `078584f7…`)
started at `19:39:05Z` — within roughly one minute of the cancelled run's
completion (`19:39:06Z`) — and finished with `conclusion: success` at
`19:49:31Z`. All subsequent `Deploy Azure App Service` runs through
`2026-10-18T21:21:50Z` (7 runs) completed with `conclusion: success`; none
were cancelled. This confirms the pipeline reached a definitive outcome
promptly after the cancellation and has not recurred.

## Disposition against #77 acceptance criteria

- **Root cause of the cancellation is identified and documented.** ✅ Benign
  concurrency-group supersession by a subsequent commit's deployment run (with
  the R7 job-log-access caveat noted above).
- **Subsequent runs complete to a definitive success/failure state, or the
  cancellation is confirmed as intentional/expected.** ✅ The immediately
  following run for the newer commit succeeded within ~1 minute, and no
  cancellations have recurred in the runs observed since.
- **Any systemic cause is mitigated or tracked separately if out of scope.**
  The existing `cancel-in-progress: false` + SHA-staleness-rejection design is
  the intended mitigation (it serializes deployments and rejects stale
  candidates instead of silently deploying an outdated commit); no pipeline
  code change is required to close this issue.

No deployment pipeline code change was needed to satisfy #77; this document is
the evidence artifact referenced by its acceptance criteria.
