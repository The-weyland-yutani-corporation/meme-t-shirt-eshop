import assert from 'node:assert/strict';
import test from 'node:test';

import {
  OVERRIDE_LABEL,
  evaluatePolicy,
  isAutonomousPullRequest,
} from './protected-path-policy.mjs';

function pullRequest({
  login = 'developer',
  type = 'User',
  head = 'feature/example',
  labels = [],
} = {}) {
  return {
    event_name: 'pull_request',
    pull_request: {
      user: { login, type },
      head: { ref: head },
      labels: labels.map((name) => ({ name })),
    },
  };
}

test('allows ordinary application changes from an autonomous PR', () => {
  const result = evaluatePolicy({
    event: pullRequest({ login: 'copilot-swe-agent[bot]', type: 'Bot' }),
    files: ['app/page.tsx', 'package.json'],
  });
  assert.equal(result.allowed, true);
  assert.equal(result.violations.length, 0);
});

test('blocks autonomous changes to every protected category', () => {
  const event = pullRequest({ head: 'squad/implement-42' });
  const files = [
    '.env.production',
    'infra/iam/role-assignments.tf',
    'infra/billing/budget.tf',
    'infra/dns/route53.tf',
    'db/migrations/0042_drop_legacy_table.sql',
    '.github/aw/actions-lock.json',
  ];
  const result = evaluatePolicy({ event, files });
  assert.equal(result.allowed, false);
  assert.deepEqual(
    new Set(result.violations.map(({ category }) => category)),
    new Set([
      'credentials or secrets configuration',
      'identity or role assignments',
      'billing configuration',
      'DNS configuration',
      'destructive migration',
      'factory or control-plane configuration',
    ]),
  );
});

test('allows a maintainer override label', () => {
  const result = evaluatePolicy({
    event: pullRequest({
      login: 'github-actions[bot]',
      type: 'Bot',
      labels: [OVERRIDE_LABEL],
    }),
    files: ['.github/factories/release.js'],
  });
  assert.equal(result.allowed, true);
  assert.equal(result.overridden, true);
});

test('allows human bootstrap changes while requiring manual review', () => {
  const event = pullRequest();
  const result = evaluatePolicy({
    event,
    files: ['.github/workflows/squad-bootstrap.md'],
  });
  assert.equal(isAutonomousPullRequest(event), false);
  assert.equal(result.allowed, true);
  assert.equal(result.violations.length, 1);
});

test('protects the policy and CI control plane from self-modification', () => {
  const result = evaluatePolicy({
    event: pullRequest({ login: 'copilot-swe-agent[bot]', type: 'Bot' }),
    files: [
      '.github/workflows/ci.yml',
      '.github/scripts/protected-path-policy.mjs',
      '.github/scripts/workflow-dispatch-status-bridge.mjs',
    ],
  });
  assert.equal(result.allowed, false);
  assert.equal(result.violations.length, 3);
});

test('does not treat push events as autonomous pull requests', () => {
  assert.equal(isAutonomousPullRequest({ event_name: 'push' }), false);
});
