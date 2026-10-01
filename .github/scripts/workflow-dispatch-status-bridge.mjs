const SHA = /^[0-9a-f]{40}$/;
const SQUAD_HEAD = /^squad\/(?:implement|deps)-/;

export const STATUS_CONTEXTS = Object.freeze({
  application: "Application checks",
  agenticWorkflows: "GH-AW compiled workflow freshness",
  squadInstall: "Squad installation integrity",
  protectedPathPolicy: "Protected path policy",
});

function exactString(value, name) {
  const result = String(value ?? "").trim();
  if (!result) throw new Error(`${name} is required`);
  return result;
}

function exactSha(value, name) {
  const result = exactString(value, name);
  if (!SHA.test(result)) throw new Error(`${name} must be a lowercase 40-character SHA`);
  return result;
}

function parseLabels(value) {
  let labels;
  try {
    labels = JSON.parse(exactString(value, "labels_json"));
  } catch (error) {
    throw new Error(
      `labels_json must be a JSON array: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
  if (
    !Array.isArray(labels) ||
    labels.some((label) => typeof label !== "string" || !label.trim())
  ) {
    throw new Error("labels_json must contain only non-empty strings");
  }
  const normalized = labels.map((label) => label.trim()).sort();
  if (new Set(normalized).size !== normalized.length) {
    throw new Error("labels_json must not contain duplicates");
  }
  return normalized;
}

export function parseDispatchInputs(inputs) {
  const rawPullNumber = exactString(inputs?.prNumber, "pr_number");
  if (!/^[1-9][0-9]*$/.test(rawPullNumber)) {
    throw new Error("pr_number must be a positive integer");
  }

  return {
    pullNumber: Number(rawPullNumber),
    baseSha: exactSha(inputs?.baseSha, "base_sha"),
    headSha: exactSha(inputs?.headSha, "head_sha"),
    headRef: exactString(inputs?.headRef, "head_ref"),
    actorLogin: exactString(inputs?.actorLogin, "actor_login"),
    actorType: exactString(inputs?.actorType, "actor_type"),
    labels: parseLabels(inputs?.labelsJson),
  };
}

function pullLabels(pull) {
  return (pull?.labels ?? [])
    .map((label) => (typeof label === "string" ? label : label?.name))
    .map((label) => String(label ?? "").trim())
    .filter(Boolean)
    .sort();
}

export function validateDispatchTarget({
  pull,
  repository,
  defaultBranch,
  runHeadSha,
  inputs,
}) {
  if (runHeadSha !== inputs.headSha) {
    return { ok: false, reason: "workflow run head does not match head_sha" };
  }
  if (
    pull?.number !== inputs.pullNumber ||
    pull?.state !== "open" ||
    pull?.base?.repo?.full_name !== repository ||
    pull?.head?.repo?.full_name !== repository
  ) {
    return { ok: false, reason: "pull request is not the expected same-repository open PR" };
  }
  if (
    pull.base?.ref !== defaultBranch ||
    pull.base?.sha !== inputs.baseSha ||
    pull.head?.ref !== inputs.headRef ||
    pull.head?.sha !== inputs.headSha
  ) {
    return { ok: false, reason: "pull request base or head changed after dispatch" };
  }
  if (
    pull.user?.login !== inputs.actorLogin ||
    pull.user?.type !== inputs.actorType
  ) {
    return { ok: false, reason: "pull request author identity changed after dispatch" };
  }
  if (JSON.stringify(pullLabels(pull)) !== JSON.stringify(inputs.labels)) {
    return { ok: false, reason: "pull request labels changed after dispatch" };
  }
  if (
    pull.user?.login !== "github-actions[bot]" ||
    pull.user?.type !== "Bot" ||
    !inputs.labels.includes("squad") ||
    !SQUAD_HEAD.test(inputs.headRef)
  ) {
    return { ok: false, reason: "pull request is not a trusted Squad continuation" };
  }

  return { ok: true };
}

export function statusStateForJobResult(result) {
  if (result === "success") return "success";
  if (["failure", "cancelled", "skipped"].includes(result)) return "failure";
  return "error";
}

export function buildCommitStatuses(jobResults, targetUrl) {
  return Object.entries(STATUS_CONTEXTS).map(([job, context]) => {
    const result = String(jobResults?.[job] ?? "");
    return {
      context,
      state: statusStateForJobResult(result),
      description:
        result === "success"
          ? "Corresponding workflow_dispatch job succeeded"
          : `Corresponding workflow_dispatch job result: ${result || "missing"}`,
      target_url: targetUrl,
    };
  });
}

export async function publishWorkflowDispatchStatuses({
  github,
  owner,
  repo,
  defaultBranch,
  runHeadSha,
  runId,
  serverUrl,
  rawInputs,
  jobResults,
}) {
  const inputs = parseDispatchInputs(rawInputs);
  const repository = `${owner}/${repo}`;
  const targetUrl = `${serverUrl}/${repository}/actions/runs/${runId}`;
  const { data: pull } = await github.rest.pulls.get({
    owner,
    repo,
    pull_number: inputs.pullNumber,
  });
  const validation = validateDispatchTarget({
    pull,
    repository,
    defaultBranch,
    runHeadSha,
    inputs,
  });
  if (!validation.ok) throw new Error(validation.reason);

  const statuses = buildCommitStatuses(jobResults, targetUrl);
  for (const status of statuses) {
    await github.rest.repos.createCommitStatus({
      owner,
      repo,
      sha: inputs.headSha,
      ...status,
    });
  }

  return { headSha: inputs.headSha, statuses };
}
