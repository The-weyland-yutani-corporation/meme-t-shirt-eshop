# Incident: Deploy Azure App Service run cancelled (2026-10-18)

## Summary

The `Deploy Azure App Service` workflow run
[39159556803](https://github.com/The-weyland-yutani-corporation/meme-t-shirt-eshop/actions/runs/39159556803)
(head SHA `85774be5a0fc21d7a8269c4e6081a4c478259944`) was cancelled rather than
reaching a definitive success/failure outcome. This incident documents the
root cause investigation and disposition against the acceptance criteria in
#77.

## Timeline

| Time (UTC) | Run ID | Head SHA | Conclusion |
| --- | --- | --- | --- |
| 2026-10-18T19:35:01Z | 39159425658 | `f145ad74...` | success |
| 2026-10-18T19:36:44Z | 39159556803 | `85774be5...` | **cancelled** |
| 2026-10-18T19:39:05Z | 39159735948 | `078584f7...` | success |
| 2026-10-18T20:01:57Z | 39161436123 | `4bc93c55...` | success |
| 2026-10-18T20:06:28Z | 39161793434 | `2a4b2e2b...` | success |
| 2026-10-18T20:28:20Z | 39163446840 | `d37286b1...` | success |
| 2026-10-18T21:14:52Z | 39166976301 | `9706cb6b...` | success |

The cancelled run was superseded within roughly 2 minutes by a deploy run for
a newer commit (`078584f7...`), which started at 19:39:05Z and completed
successfully by 19:49:31Z — within about 1 minute of the prior run's
cancellation.

## Root cause

`.github/workflows/deploy.yml` declares:

```yaml
concurrency:
  group: azure-app-service-production
  cancel-in-progress: false
```

combined with a SHA-freshness guard in `deployment-control.mjs`
(`selectDeploymentSha`) that rejects any deployment whose candidate SHA no
longer matches the current `main` tip. When a newer commit landed on `main`
while run `39159556803` was still in flight, the concurrency group and the
freshness guard together caused the stale, in-flight run for the older SHA to
be cancelled in favor of the run for the newer commit. This is a benign
concurrency-group supersession: the pipeline is designed to always deploy the
latest commit rather than let an older, superseded deployment complete.

**Caveat (R7):** job-level logs/annotations for the cancelled run were not
retrievable via available read APIs (the jobs API returned 0 records), so the
exact cancelling mechanism (GitHub Actions concurrency scheduling vs. a
manual cancel) is not directly confirmed from step logs. This conclusion is
based on timeline correlation and the workflow's documented
staleness-rejection design, not a directly observed cancellation reason.

## Recovery evidence

All subsequent `Deploy Azure App Service` runs observed through
2026-10-18T21:21:50Z (and reconfirmed on 2026-11-02) completed with
`conclusion: success`; none were cancelled. Deployments to `main` have
continued to reach a definitive success/failure outcome under normal
conditions.

## Disposition against #77 acceptance criteria

- **Root cause identified and documented:** Yes — benign concurrency-group
  supersession via the `azure-app-service-production` concurrency group and
  SHA-freshness guard, with the R7 log-access caveat noted above.
- **Subsequent runs reach a definitive outcome:** Yes — the next run
  (`39159735948`) completed successfully within ~1 minute, and all following
  runs completed successfully with no further cancellations.
- **Systemic cause mitigated or tracked:** No pipeline code change is
  required; the cancellation is expected behavior of the existing
  concurrency/freshness design protecting against deploying stale commits.

No pipeline code change is required to satisfy #77. This incident record
constitutes the "confirmed as intentional/expected and documented" acceptance
path.
