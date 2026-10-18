import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { evaluateImplementationRecovery } from '../workflows/shared/squad-implementation-recovery.mjs';

const valid = {
  eventName: 'workflow_dispatch',
  command: 'implement',
  forceRetry: true,
  reason: 'Root cause: protected-path fallback created an issue. Remediation: the root placement guard was fixed and merged.',
  actorPermission: 'maintain',
  issueNumber: 22,
  issue: { state: 'open' },
  repository: 'octo/repo',
  openPulls: [],
  workerRuns: [{
    display_title: 'Squad implement — 22',
    status: 'completed',
    conclusion: 'failure',
  }],
  comments: [],
};

test('authorizes a bounded maintainer recovery after a matching failed worker run', () => {
  assert.deepEqual(evaluateImplementationRecovery(valid), {
    requested: true,
    authorized: true,
    reason: valid.reason,
    failures: [],
  });
});

test('authorizes recovery from a trusted controller stalled-cap comment', () => {
  const result = evaluateImplementationRecovery({
    ...valid,
    workerRuns: [],
    comments: [{
      user: { login: 'github-actions[bot]' },
      body: [
        '**Factory Controller — stalled: implementation dispatch cap reached**',
        'Issue #22 has two `Factory-Controller-Dispatch` `implement` receipts within the last 24 hours.',
        'Per policy, a third dispatch is not permitted.',
      ].join('\n'),
    }],
  });
  assert.equal(result.authorized, true);
  assert.deepEqual(result.failures, []);
});

test('fails closed when the root cause and remediation reason is missing', () => {
  const result = evaluateImplementationRecovery({ ...valid, reason: '' });
  assert.equal(result.authorized, false);
  assert.ok(result.failures.includes('recovery-reason-invalid'));
});

test('fails closed for an unauthorized dispatcher', () => {
  const result = evaluateImplementationRecovery({ ...valid, actorPermission: 'read' });
  assert.equal(result.authorized, false);
  assert.ok(result.failures.includes('recovery-actor-unauthorized'));
});

test('fails closed while a matching worker run is active', () => {
  const result = evaluateImplementationRecovery({
    ...valid,
    workerRuns: [{
      display_title: 'Squad implement — 22',
      status: 'in_progress',
      conclusion: null,
    }],
  });
  assert.equal(result.authorized, false);
  assert.ok(result.failures.includes('recovery-active-run'));
});

test('fails closed when an open pull request closes the target', () => {
  const result = evaluateImplementationRecovery({
    ...valid,
    openPulls: [{ body: 'Fixes #22' }],
  });
  assert.equal(result.authorized, false);
  assert.ok(result.failures.includes('recovery-open-closing-pr'));
});

test('fails closed for the wrong command or event', () => {
  const wrongCommand = evaluateImplementationRecovery({ ...valid, command: 'plan' });
  assert.equal(wrongCommand.authorized, false);
  assert.ok(wrongCommand.failures.includes('recovery-command-invalid'));

  const wrongEvent = evaluateImplementationRecovery({ ...valid, eventName: 'schedule' });
  assert.equal(wrongEvent.authorized, false);
  assert.ok(wrongEvent.failures.includes('recovery-event-invalid'));
});

test('wires recovery through the source and compiled workflow', () => {
  const source = readFileSync(
    new URL('../workflows/squad.md', import.meta.url),
    'utf8',
  );
  const compiled = readFileSync(
    new URL('../workflows/squad.lock.yml', import.meta.url),
    'utf8',
  );
  for (const workflow of [source, compiled]) {
    assert.match(workflow, /force_implementation_retry:/);
    assert.match(workflow, /recovery_reason:/);
    assert.match(workflow, /Authorize maintainer implementation recovery/);
    assert.match(workflow, /SQUAD_IMPLEMENTATION_RECOVERY_AUTHORIZED/);
  }
});
