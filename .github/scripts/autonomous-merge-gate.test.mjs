import assert from "node:assert/strict";
import test from "node:test";

import {
  REQUIRED_CHECKS,
  completePostMergeCleanup,
  dispatchPostMergeWorkflows,
  evaluateChecks,
  evaluatePostMergeCleanup,
  evaluateSourceIssue,
  evaluateSquadReview,
  isEligiblePullRequest,
  isTruthy,
  parseImplementationMarker,
  updateBehindPullRequest,
} from "./autonomous-merge-gate.mjs";

const sha = "a".repeat(40);
const updatedSha = "b".repeat(40);

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
    ["<!-- squad:implement issue=1 run=2 -->", "squad/implement-1/nested"],
  ];
  for (const [body, branch] of cases) {
    assert.equal(parseImplementationMarker(body, branch).ok, false);
  }
});

test("permits cleanup only for the exact same-repository implementation head", () => {
  const pull = {
    head: {
      ref: "squad/implement-42-add-widget-deadbeef",
      repo: { full_name: "owner/repo" },
    },
  };
  assert.deepEqual(evaluatePostMergeCleanup(pull, "owner/repo", 42), {
    ok: true,
    issue: 42,
    headRef: "squad/implement-42-add-widget-deadbeef",
    gitRef: "heads/squad/implement-42-add-widget-deadbeef",
  });
  assert.equal(
    evaluatePostMergeCleanup(
      { ...pull, head: { ...pull.head, repo: { full_name: "fork/repo" } } },
      "owner/repo",
      42,
    ).ok,
    false,
  );
  assert.equal(evaluatePostMergeCleanup(pull, "owner/repo", 43).ok, false);
  assert.equal(
    evaluatePostMergeCleanup(
      { ...pull, head: { ...pull.head, ref: "feature/42" } },
      "owner/repo",
      42,
    ).ok,
    false,
  );
});

function cleanupGithub({
  issueState = "open",
  refExists = true,
  issueUpdatePersists = true,
  refDeletePersists = true,
} = {}) {
  const calls = [];
  let state = issueState;
  let exists = refExists;
  return {
    calls,
    github: {
      rest: {
        issues: {
          async get() {
            calls.push("issues.get");
            return { data: { state, labels: [{ name: "squad:builder" }] } };
          },
          async update({ state: nextState }) {
            calls.push("issues.update");
            if (issueUpdatePersists) state = nextState;
            return { data: { state } };
          },
        },
        git: {
          async getRef({ ref }) {
            calls.push(`git.getRef:${ref}`);
            if (!exists) throw Object.assign(new Error("Not Found"), { status: 404 });
            return { data: { ref: `refs/${ref}` } };
          },
          async deleteRef({ ref }) {
            calls.push(`git.deleteRef:${ref}`);
            if (refDeletePersists) exists = false;
          },
        },
      },
    },
  };
}

test("closes the source issue and deletes the exact implementation head", async () => {
  const mock = cleanupGithub();
  const result = await completePostMergeCleanup({
    github: mock.github,
    owner: "owner",
    repo: "repo",
    repository: "owner/repo",
    issueNumber: 42,
    pull: {
      head: {
        ref: "squad/implement-42-add-widget-deadbeef",
        repo: { full_name: "owner/repo" },
      },
    },
  });
  assert.equal(result.issueAlreadyClosed, false);
  assert.equal(result.headAlreadyDeleted, false);
  assert.equal(mock.calls.includes("issues.update"), true);
  assert.equal(
    mock.calls.includes(
      "git.deleteRef:heads/squad/implement-42-add-widget-deadbeef",
    ),
    true,
  );
});

test("treats already-closed issues and deleted heads as successful cleanup", async () => {
  const mock = cleanupGithub({ issueState: "closed", refExists: false });
  const result = await completePostMergeCleanup({
    github: mock.github,
    owner: "owner",
    repo: "repo",
    repository: "owner/repo",
    issueNumber: 42,
    pull: {
      head: {
        ref: "squad/implement-42-add-widget-deadbeef",
        repo: { full_name: "owner/repo" },
      },
    },
  });
  assert.equal(result.issueAlreadyClosed, true);
  assert.equal(result.headAlreadyDeleted, true);
  assert.equal(mock.calls.includes("issues.update"), false);
  assert.equal(
    mock.calls.some((call) => call.startsWith("git.deleteRef:")),
    false,
  );
});

test("fails when either required post-merge condition is not achieved", async () => {
  const pull = {
    head: {
      ref: "squad/implement-42-add-widget-deadbeef",
      repo: { full_name: "owner/repo" },
    },
  };
  const parameters = {
    owner: "owner",
    repo: "repo",
    repository: "owner/repo",
    issueNumber: 42,
    pull,
  };

  await assert.rejects(
    completePostMergeCleanup({
      ...parameters,
      github: cleanupGithub({ issueUpdatePersists: false }).github,
    }),
    /did not reach the closed state/,
  );
  await assert.rejects(
    completePostMergeCleanup({
      ...parameters,
      github: cleanupGithub({ refDeletePersists: false }).github,
    }),
    /still exists/,
  );
});

function postMergeGithub({
  pullMergeSha = updatedSha,
  defaultBranchSha = updatedSha,
} = {}) {
  const dispatches = [];
  return {
    dispatches,
    github: {
      rest: {
        pulls: {
          async get() {
            return {
              data: {
                number: 42,
                state: "closed",
                merged: true,
                merge_commit_sha: pullMergeSha,
                base: {
                  ref: "main",
                  repo: { full_name: "owner/repo" },
                },
              },
            };
          },
        },
        git: {
          async getRef() {
            return {
              data: {
                ref: "refs/heads/main",
                object: { sha: defaultBranchSha },
              },
            };
          },
        },
        actions: {
          async createWorkflowDispatch(parameters) {
            dispatches.push(parameters);
          },
        },
      },
    },
  };
}

test("dispatches deployment with the refetched squash merge SHA", async () => {
  const mock = postMergeGithub();
  const result = await dispatchPostMergeWorkflows({
    github: mock.github,
    owner: "owner",
    repo: "repo",
    repository: "owner/repo",
    defaultBranch: "main",
    pullNumber: 42,
    mergeSha: updatedSha,
  });

  assert.equal(result.mergeSha, updatedSha);
  assert.deepEqual(mock.dispatches, [
    {
      owner: "owner",
      repo: "repo",
      workflow_id: "factory-controller.lock.yml",
      ref: "main",
    },
    {
      owner: "owner",
      repo: "repo",
      workflow_id: "deploy.yml",
      ref: "main",
      inputs: {
        operation: "deploy",
        deployment_sha: updatedSha,
      },
    },
  ]);
});

test("refuses stale or unconfirmed post-merge deployment dispatches", async () => {
  for (const mock of [
    postMergeGithub({ pullMergeSha: sha }),
    postMergeGithub({ defaultBranchSha: sha }),
  ]) {
    await assert.rejects(
      dispatchPostMergeWorkflows({
        github: mock.github,
        owner: "owner",
        repo: "repo",
        repository: "owner/repo",
        defaultBranch: "main",
        pullNumber: 42,
        mergeSha: updatedSha,
      }),
      /expected squash merge|default branch advanced/,
    );
    assert.deepEqual(mock.dispatches, []);
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

test("accepts exact required commit statuses published by dispatched CI", () => {
  assert.deepEqual(
    evaluateChecks(
      REQUIRED_CHECKS.map((context, index) => ({
        id: index + 1,
        context,
        state: "success",
      })),
    ),
    { ok: true },
  );
  assert.equal(
    evaluateChecks(
      REQUIRED_CHECKS.map((context, index) => ({
        id: index + 1,
        context,
        state: index === 0 ? "pending" : "success",
      })),
    ).ok,
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
        number: 42,
        body: "<!-- squad:implement issue=42 run=9001 -->",
        state: "open",
        draft: false,
        base: { ref: "main", repo: { full_name: "owner/repo" } },
        head: {
          ref: "squad/implement-42-add-widget",
          sha,
          repo: { full_name: "owner/repo" },
        },
      },
      "owner/repo",
    ),
    true,
  );
  assert.equal(isTruthy(" YES "), true);
  assert.equal(isTruthy("false"), false);
});

function updatePull(overrides = {}) {
  return {
    number: 42,
    state: "open",
    draft: false,
    body: "<!-- squad:implement issue=42 run=9001 -->",
    mergeable_state: "behind",
    base: { ref: "main", repo: { full_name: "owner/repo" } },
    head: {
      ref: "squad/implement-42-add-widget",
      sha,
      repo: { full_name: "owner/repo" },
    },
    ...overrides,
  };
}

function updateGithub(pulls, updateError) {
  const calls = [];
  const queue = [...pulls];
  return {
    calls,
    github: {
      rest: {
        pulls: {
          async get(parameters) {
            calls.push(["get", parameters]);
            return { data: queue.shift() ?? pulls.at(-1) };
          },
          async updateBranch(parameters) {
            calls.push(["updateBranch", parameters]);
            if (updateError) throw updateError;
            return { status: 202, data: { message: "Updating pull request branch." } };
          },
        },
      },
    },
  };
}

const updateParameters = {
  owner: "owner",
  repo: "repo",
  repository: "owner/repo",
  pullNumber: 42,
  expectedHeadSha: sha,
  expectedIssue: 42,
  sleep: async () => {},
};

test("updates an exact same-repository behind implementation head", async () => {
  const mock = updateGithub([
    updatePull(),
    updatePull({ head: { ...updatePull().head, sha: updatedSha } }),
  ]);
  const result = await updateBehindPullRequest({
    ...updateParameters,
    github: mock.github,
  });

  assert.equal(result.updated, true);
  assert.equal(result.pull.head.sha, updatedSha);
  assert.deepEqual(mock.calls[1], [
    "updateBranch",
    {
      owner: "owner",
      repo: "repo",
      pull_number: 42,
      expected_head_sha: sha,
    },
  ]);
});

test("rejects fork heads before requesting a branch update", async () => {
  const mock = updateGithub([
    updatePull({
      head: { ...updatePull().head, repo: { full_name: "fork/repo" } },
    }),
  ]);
  await assert.rejects(
    updateBehindPullRequest({ ...updateParameters, github: mock.github }),
    /identity or eligibility changed/,
  );
  assert.equal(mock.calls.some(([name]) => name === "updateBranch"), false);
});

test("rejects a changed head before requesting a branch update", async () => {
  const mock = updateGithub([
    updatePull({ head: { ...updatePull().head, sha: updatedSha } }),
  ]);
  await assert.rejects(
    updateBehindPullRequest({ ...updateParameters, github: mock.github }),
    /head changed/,
  );
  assert.equal(mock.calls.some(([name]) => name === "updateBranch"), false);
});

test("returns the fresh pull unchanged when GitHub does not report behind", async () => {
  const fresh = updatePull({ mergeable_state: "clean" });
  const mock = updateGithub([fresh]);
  const result = await updateBehindPullRequest({
    ...updateParameters,
    github: mock.github,
  });

  assert.deepEqual(result, { updated: false, pull: fresh });
  assert.equal(mock.calls.some(([name]) => name === "updateBranch"), false);
});

test("fails on update API and postcondition failures", async () => {
  const apiFailure = updateGithub(
    [updatePull()],
    Object.assign(new Error("server error"), { status: 500 }),
  );
  await assert.rejects(
    updateBehindPullRequest({
      ...updateParameters,
      github: apiFailure.github,
    }),
    /server error/,
  );

  const stale = updateGithub([updatePull()]);
  await assert.rejects(
    updateBehindPullRequest({
      ...updateParameters,
      github: stale.github,
      postconditionAttempts: 2,
    }),
    /head did not change/,
  );
});

test("accepts a 422 race only after a re-fetch proves progress", async () => {
  const progressed = updateGithub(
    [
      updatePull(),
      updatePull({ head: { ...updatePull().head, sha: updatedSha } }),
    ],
    Object.assign(new Error("unprocessable"), { status: 422 }),
  );
  const result = await updateBehindPullRequest({
    ...updateParameters,
    github: progressed.github,
  });
  assert.equal(result.updated, true);
  assert.equal(result.raced, true);

  const stuck = updateGithub(
    [updatePull()],
    Object.assign(new Error("unprocessable"), { status: 422 }),
  );
  await assert.rejects(
    updateBehindPullRequest({ ...updateParameters, github: stuck.github }),
    /returned 422 and remains behind/,
  );
});
