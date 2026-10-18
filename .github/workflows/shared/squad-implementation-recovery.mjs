const ACTIVE_RUN_STATUSES = new Set([
  'queued',
  'in_progress',
  'requested',
  'waiting',
  'pending',
]);
const AUTHORIZED_PERMISSIONS = new Set(['admin', 'maintain', 'write']);
const RECOVERABLE_CONCLUSIONS = new Set(['failure', 'cancelled']);
const WORKER_RUN_NAME = /^Squad implement — ([1-9][0-9]*)$/;

function text(value) {
  return String(value ?? '').trim();
}

function closesIssue(body, issueNumber, repository) {
  const escapedRepository = repository.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const reference = `(?:#${issueNumber}\\b|${escapedRepository}#${issueNumber}\\b|https:\\/\\/github\\.com\\/${escapedRepository}\\/issues\\/${issueNumber}\\b)`;
  return new RegExp(`\\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\\s+${reference}`, 'i')
    .test(String(body ?? ''));
}

function trustedStalledCapComment(comment, issueNumber) {
  if (comment?.user?.login !== 'github-actions[bot]') return false;
  const body = String(comment.body ?? '');
  return body.includes('**Factory Controller — stalled: implementation dispatch cap reached**') &&
    body.includes(`Issue #${issueNumber}`) &&
    body.includes('two `Factory-Controller-Dispatch` `implement` receipts within the last 24 hours') &&
    body.includes('a third dispatch is not permitted');
}

export function evaluateImplementationRecovery({
  eventName,
  command,
  forceRetry,
  reason,
  actorPermission,
  issueNumber,
  issue,
  repository,
  openPulls = [],
  workerRuns = [],
  comments = [],
}) {
  const failures = [];
  const normalizedReason = text(reason);
  const requested = forceRetry === true || text(forceRetry) === 'true';

  if (!requested) return { requested: false, authorized: false, failures: [] };
  if (eventName !== 'workflow_dispatch') failures.push('recovery-event-invalid');
  if (text(command) !== 'implement') failures.push('recovery-command-invalid');
  if (!/^Root cause:\s+\S[\s\S]*\bRemediation:\s+\S/i.test(normalizedReason)) {
    failures.push('recovery-reason-invalid');
  }
  if (!AUTHORIZED_PERMISSIONS.has(text(actorPermission).toLowerCase())) {
    failures.push('recovery-actor-unauthorized');
  }
  if (!Number.isSafeInteger(issueNumber) || issueNumber <= 0) {
    failures.push('recovery-issue-number-invalid');
  }
  if (issue?.state !== 'open' || issue?.pull_request) {
    failures.push('recovery-target-not-open-issue');
  }

  if (openPulls.some((pull) => closesIssue(pull?.body, issueNumber, repository))) {
    failures.push('recovery-open-closing-pr');
  }

  let matchingFailedRun = false;
  for (const run of workerRuns) {
    const match = WORKER_RUN_NAME.exec(text(run?.display_title ?? run?.name));
    if (ACTIVE_RUN_STATUSES.has(text(run?.status).toLowerCase()) && !match) {
      failures.push('recovery-active-run-unresolved');
      continue;
    }
    if (!match || Number(match[1]) !== issueNumber) continue;
    if (ACTIVE_RUN_STATUSES.has(text(run?.status).toLowerCase())) {
      failures.push('recovery-active-run');
    }
    if (
      text(run?.status).toLowerCase() === 'completed' &&
      RECOVERABLE_CONCLUSIONS.has(text(run?.conclusion).toLowerCase())
    ) {
      matchingFailedRun = true;
    }
  }

  if (!matchingFailedRun && !comments.some((comment) => trustedStalledCapComment(comment, issueNumber))) {
    failures.push('recovery-no-failure-evidence');
  }

  return {
    requested: true,
    authorized: failures.length === 0,
    reason: normalizedReason,
    failures: [...new Set(failures)],
  };
}
