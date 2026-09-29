import assert from "node:assert/strict";
import test from "node:test";

import {
  REQUIRED_CHECKS,
  evaluateChecks,
  evaluateSourceIssue,
  evaluateSquadReview,
  isEligiblePullRequest,
  isTruthy,
  parseImplementationMarker,
} from "./autonomous-merge-gate.mjs";

const sha = "a".repeat(40);

test("accepts one standalone marker on its matching implementation branch", () => {
  assert.deepEqual(
    parseImplementationMarker(
      `Summary\r\n\r\n<!-- squad:implement issue=42 run=9001 -->\r\n`,
      "squad/implement-42-add-widget",
    ),
    { ok: true, issue: 42, run: 9001 },
  );
});

test("rejects malformed, embedded, duplicated, and branch-mismatched markers", () => {
  const cases = [
    ["<!-- squad:implement issue=0 run=1 -->", "squad/implement-0-x"],
    ["prefix <!-- squad:implement issue=1 run=2 -->", "squad/implement-1-x"],
    [
      "<!-- squad:implement issue=1 run=2 -->\n<!-- squad:implement issue=1 run=2 -->",
      "squad/implement-1-x",
    ],
    ["<!-- squad:implement issue=1 run=2 -->", "squad/implement-2-x"],
  ];
  for (const [body, branch] of cases) {
    assert.equal(parseImplementationMarker(body, branch).ok, false);
  }
});

test("requires a bot COMMENT review for the exact current head", () => {
  const valid = {
    user: { login: "github-actions[bot]" },
    commit_id: sha,
    state: "COMMENTED",
    body: `Advisory review.\n\nSquad-Review-Head: ${sha}`,
  };
  assert.deepEqual(evaluateSquadReview([valid], sha), { ok: true });
  assert.equal(
    evaluateSquadReview([{ ...valid, user: { login: "octocat" } }], sha).ok,
    false,
  );
  assert.equal(
    evaluateSquadReview([{ ...valid, commit_id: "b".repeat(40) }], sha).ok,
    false,
  );
  assert.equal(
    evaluateSquadReview([{ ...valid, state: "APPROVED" }], sha).ok,
    false,
  );
});

test("current-head Squad REQUEST_CHANGES overrides a COMMENT", () => {
  const base = {
    user: { login: "github-actions[bot]" },
    commit_id: sha,
    body: `Squad-Review-Head: ${sha}`,
  };
  assert.equal(
    evaluateSquadReview(
      [{ ...base, state: "COMMENTED" }, { ...base, state: "CHANGES_REQUESTED" }],
      sha,
    ).ok,
    false,
  );
});

test("requires the latest run of every exact required check to succeed", () => {
  const successful = REQUIRED_CHECKS.map((name, index) => ({
    id: index + 1,
    name,
    status: "completed",
    conclusion: "success",
  }));
  assert.deepEqual(evaluateChecks(successful), { ok: true });
  assert.equal(evaluateChecks(successful.slice(1)).ok, false);
  assert.equal(
    evaluateChecks([
      ...successful,
      {
        id: 100,
        name: REQUIRED_CHECKS[0],
        status: "completed",
        conclusion: "failure",
      },
      {
        id: 101,
        name: "Evaluate merge candidates",
        status: "completed",
        conclusion: "success",
      },
    ]).ok,
    false,
  );
});

test("validates source issues, pull request shape, and variable truthiness", () => {
  assert.deepEqual(
    evaluateSourceIssue({ state: "closed", labels: [{ name: "squad:builder" }] }),
    { ok: true },
  );
  assert.equal(
    evaluateSourceIssue({
      state: "open",
      labels: ["squad:builder"],
      pull_request: {},
    }).ok,
    false,
  );
  assert.equal(
    isEligiblePullRequest(
      {
        state: "open",
        draft: false,
        base: { ref: "main" },
        head: { repo: { full_name: "owner/repo" } },
      },
      "owner/repo",
    ),
    true,
  );
  assert.equal(isTruthy(" YES "), true);
  assert.equal(isTruthy("false"), false);
});
