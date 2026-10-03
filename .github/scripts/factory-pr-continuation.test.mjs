import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { REQUIRED_CHECKS } from "./autonomous-merge-gate.mjs";
import {
  evaluateContinuationPull,
  evaluateMergeGateEvidence,
  hasActiveMergeGateRun,
  isPendingMergeGateEvidence,
} from "./factory-pr-continuation.mjs";

const sha = "a".repeat(40);
const repository = "owner/repo";

function pull(overrides = {}) {
  return {
    state: "open",
    draft: false,
    head: {
      ref: "squad/implement-42-add-widget",
      sha,
      repo: { full_name: repository },
    },
    ...overrides,
  };
}

function successfulChecks() {
  return REQUIRED_CHECKS.map((name, index) => ({
    id: index + 1,
    name,
    status: "completed",
    conclusion: "success",
  }));
}

function successfulStatuses() {
  return REQUIRED_CHECKS.map((context, index) => ({
    id: index + 1,
    context,
    state: "success",
  }));
}

function commentedReview() {
  return {
    user: { login: "github-actions[bot]" },
    commit_id: sha,
    state: "COMMENTED",
    body: `Advisory review.\n\nSquad-Review-Head: ${sha}`,
  };
}

test("classifies only same-repository open Squad continuation branches", () => {
  assert.deepEqual(evaluateContinuationPull(pull(), repository), {
    ok: true,
    implementation: true,
  });
  assert.deepEqual(
    evaluateContinuationPull(
      pull({ head: { ...pull().head, ref: "squad/deps-42-manifest" } }),
      repository,
    ),
    { ok: true, implementation: false },
  );
  assert.equal(
    evaluateContinuationPull(
      pull({ head: { ...pull().head, repo: { full_name: "fork/repo" } } }),
      repository,
    ).ok,
    false,
  );
  assert.equal(
    evaluateContinuationPull(
      pull({ head: { ...pull().head, ref: "feature/widget" } }),
      repository,
    ).ok,
    false,
  );
});

test("requires a ready PR, successful current-head checks, and a COMMENT review", () => {
  assert.deepEqual(
    evaluateMergeGateEvidence(
      pull(),
      repository,
      successfulChecks(),
      [commentedReview()],
    ),
    { ok: true },
  );
  assert.deepEqual(
    evaluateMergeGateEvidence(
      pull({ draft: true }),
      repository,
      successfulChecks(),
      [commentedReview()],
    ),
    {
      ok: false,
      reason: "legacy draft requires one-time operator migration",
    },
  );
  assert.equal(
    evaluateMergeGateEvidence(
      pull(),
      repository,
      successfulChecks().slice(1),
      [commentedReview()],
    ).ok,
    false,
  );
  assert.equal(
    evaluateMergeGateEvidence(
      pull(),
      repository,
      successfulStatuses(),
      [{ ...commentedReview(), commit_id: "b".repeat(40) }],
    ).ok,
    false,
  );
  assert.equal(
    evaluateMergeGateEvidence(
      pull(),
      repository,
      successfulChecks(),
      [
        commentedReview(),
        { ...commentedReview(), state: "CHANGES_REQUESTED" },
      ],
    ).ok,
    false,
  );
});

test("accepts dispatched CI commit statuses as exact-head validation evidence", () => {
  assert.deepEqual(
    evaluateMergeGateEvidence(
      pull(),
      repository,
      successfulStatuses(),
      [commentedReview()],
    ),
    { ok: true },
  );
});

test("never dispatches dependency branches to the merge gate", () => {
  const dependencyPull = pull({
    head: { ...pull().head, ref: "squad/deps-42-manifest" },
  });
  assert.equal(
    evaluateMergeGateEvidence(
      dependencyPull,
      repository,
      successfulChecks(),
      [commentedReview()],
    ).ok,
    false,
  );
});

test("waits only for evidence that an active validation run can still publish", () => {
  assert.equal(
    isPendingMergeGateEvidence({
      ok: false,
      reason: "missing checks: Application checks",
    }),
    true,
  );
  assert.equal(
    isPendingMergeGateEvidence({
      ok: false,
      reason: "no current-head COMMENT Squad review",
    }),
    true,
  );
  assert.equal(
    isPendingMergeGateEvidence({
      ok: false,
      reason: "unsuccessful checks: Application checks",
    }),
    false,
  );
  assert.equal(
    isPendingMergeGateEvidence({
      ok: false,
      reason: "Squad requested changes for the current head",
    }),
    false,
  );
});

test("deduplicates only active merge-gate runs for the same pull request", () => {
  assert.equal(
    hasActiveMergeGateRun(
      [
        {
          status: "in_progress",
          display_title: "Autonomous merge gate — PR #42",
        },
      ],
      42,
    ),
    true,
  );
  assert.equal(
    hasActiveMergeGateRun(
      [
        { status: "completed", display_title: "Autonomous merge gate — PR #42" },
        { status: "queued", display_title: "Autonomous merge gate — PR #43" },
      ],
      42,
    ),
    false,
  );
});

test("requires Squad review deduplication to use only the exact current head", () => {
  const policy = readFileSync(
    new URL("../workflows/squad-review.md", import.meta.url),
    "utf8",
  );
  assert.match(
    policy,
    /Deduplication is only by that exact current-head\s+marker\./,
  );
  assert.match(policy, /A changed head SHA always requires a new review/);
  assert.match(policy, /Never carry a prior-head review forward/);
  assert.match(policy, /semantic or blob equivalence/);
});

test("continuation keeps pending exact-head validation alive before gate dispatch", () => {
  const workflow = readFileSync(
    new URL("../workflows/factory-pr-continuation.yml", import.meta.url),
    "utf8",
  );
  assert.match(workflow, /timeout-minutes: 20/);
  assert.match(workflow, /isPendingMergeGateEvidence/);
  assert.match(workflow, /await new Promise\(\(resolve\) => setTimeout\(resolve, 15_000\)\)/);
  assert.match(workflow, /dispatched autonomous merge gate/);
});
