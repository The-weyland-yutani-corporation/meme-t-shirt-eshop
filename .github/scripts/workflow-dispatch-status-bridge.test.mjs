import assert from "node:assert/strict";
import test from "node:test";

import {
  STATUS_CONTEXTS,
  buildCommitStatuses,
  parseDispatchInputs,
  publishWorkflowDispatchStatuses,
  validateDispatchTarget,
} from "./workflow-dispatch-status-bridge.mjs";

const repository = "owner/repo";
const baseSha = "a".repeat(40);
const headSha = "b".repeat(40);
const headRef = "squad/implement-42-add-widget";

function rawInputs(overrides = {}) {
  return {
    prNumber: "17",
    baseSha,
    headSha,
    headRef,
    actorLogin: "github-actions[bot]",
    actorType: "Bot",
    labelsJson: JSON.stringify(["squad"]),
    ...overrides,
  };
}

function pull(overrides = {}) {
  return {
    number: 17,
    state: "open",
    base: {
      ref: "main",
      sha: baseSha,
      repo: { full_name: repository },
    },
    head: {
      ref: headRef,
      sha: headSha,
      repo: { full_name: repository },
    },
    user: { login: "github-actions[bot]", type: "Bot" },
    labels: [{ name: "squad" }],
    ...overrides,
  };
}

test("strictly validates the dispatched PR identity and exact current head", () => {
  const inputs = parseDispatchInputs(rawInputs());
  assert.deepEqual(
    validateDispatchTarget({
      pull: pull(),
      repository,
      defaultBranch: "main",
      runHeadSha: headSha,
      inputs,
    }),
    { ok: true },
  );

  for (const candidate of [
    { runHeadSha: "c".repeat(40) },
    { pull: pull({ state: "closed" }) },
    { pull: pull({ head: { ...pull().head, sha: "c".repeat(40) } }) },
    { pull: pull({ base: { ...pull().base, sha: "c".repeat(40) } }) },
    { pull: pull({ user: { login: "developer", type: "User" } }) },
    { pull: pull({ labels: [] }) },
  ]) {
    assert.equal(
      validateDispatchTarget({
        pull: candidate.pull ?? pull(),
        repository,
        defaultBranch: "main",
        runHeadSha: candidate.runHeadSha ?? headSha,
        inputs,
      }).ok,
      false,
    );
  }
});

test("rejects malformed or incomplete dispatch inputs", () => {
  assert.throws(
    () => parseDispatchInputs(rawInputs({ headSha: "not-a-sha" })),
    /head_sha/,
  );
  assert.throws(
    () => parseDispatchInputs(rawInputs({ labelsJson: "{}" })),
    /labels_json/,
  );
  assert.throws(
    () => parseDispatchInputs(rawInputs({ actorLogin: "" })),
    /actor_login/,
  );
});

test("maps only successful jobs to successful required contexts", () => {
  const statuses = buildCommitStatuses(
    {
      application: "success",
      agenticWorkflows: "failure",
      squadInstall: "cancelled",
      protectedPathPolicy: "skipped",
    },
    "https://example.test/run",
  );

  assert.deepEqual(
    statuses.map(({ context, state }) => ({ context, state })),
    [
      { context: STATUS_CONTEXTS.application, state: "success" },
      { context: STATUS_CONTEXTS.agenticWorkflows, state: "failure" },
      { context: STATUS_CONTEXTS.squadInstall, state: "failure" },
      { context: STATUS_CONTEXTS.protectedPathPolicy, state: "failure" },
    ],
  );
  assert.ok(statuses.every((status) => status.target_url === "https://example.test/run"));
});

test("publishes exact contexts on only the validated head SHA", async () => {
  const writes = [];
  const github = {
    rest: {
      pulls: {
        get: async () => ({ data: pull() }),
      },
      repos: {
        createCommitStatus: async (status) => writes.push(status),
      },
    },
  };

  const result = await publishWorkflowDispatchStatuses({
    github,
    owner: "owner",
    repo: "repo",
    defaultBranch: "main",
    runHeadSha: headSha,
    runId: "123",
    serverUrl: "https://github.example",
    rawInputs: rawInputs(),
    jobResults: {
      application: "success",
      agenticWorkflows: "success",
      squadInstall: "success",
      protectedPathPolicy: "failure",
    },
  });

  assert.equal(result.headSha, headSha);
  assert.equal(writes.length, 4);
  assert.ok(writes.every((write) => write.sha === headSha));
  assert.deepEqual(
    writes.map(({ context, state }) => ({ context, state })),
    [
      { context: "Application checks", state: "success" },
      { context: "GH-AW compiled workflow freshness", state: "success" },
      { context: "Squad installation integrity", state: "success" },
      { context: "Protected path policy", state: "failure" },
    ],
  );
  assert.ok(
    writes.every(
      (write) =>
        write.target_url ===
        "https://github.example/owner/repo/actions/runs/123",
    ),
  );
});

test("writes no statuses when live PR revalidation fails", async () => {
  const writes = [];
  const github = {
    rest: {
      pulls: {
        get: async () => ({
          data: pull({ head: { ...pull().head, sha: "c".repeat(40) } }),
        }),
      },
      repos: {
        createCommitStatus: async (status) => writes.push(status),
      },
    },
  };

  await assert.rejects(
    publishWorkflowDispatchStatuses({
      github,
      owner: "owner",
      repo: "repo",
      defaultBranch: "main",
      runHeadSha: headSha,
      runId: "123",
      serverUrl: "https://github.example",
      rawInputs: rawInputs(),
      jobResults: {
        application: "success",
        agenticWorkflows: "success",
        squadInstall: "success",
        protectedPathPolicy: "success",
      },
    }),
    /changed after dispatch/,
  );
  assert.deepEqual(writes, []);
});
