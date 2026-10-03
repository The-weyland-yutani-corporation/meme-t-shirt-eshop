const IMPLEMENT_MARKER =
  /^<!-- squad:implement issue=([1-9][0-9]*) run=([1-9][0-9]*) -->$/;
const IMPLEMENT_BRANCH =
  /^squad\/implement-([1-9][0-9]*)-[A-Za-z0-9][A-Za-z0-9._-]*$/;
const SHA = /^[0-9a-f]{40}$/;

export const REQUIRED_CHECKS = Object.freeze([
  "Application checks",
  "GH-AW compiled workflow freshness",
  "Squad installation integrity",
  "Protected path policy",
]);

function lines(value) {
  return String(value ?? "").replace(/\r\n?/g, "\n").split("\n");
}

export function isTruthy(value) {
  return ["true", "1", "yes", "on"].includes(
    String(value ?? "").trim().toLowerCase(),
  );
}

export function parseImplementationMarker(body, headRef) {
  const text = String(body ?? "").replace(/\r\n?/g, "\n");
  const markerLikeCount = text.split("squad:implement").length - 1;
  const matches = lines(text)
    .map((line) => line.match(IMPLEMENT_MARKER))
    .filter(Boolean);

  if (markerLikeCount !== 1 || matches.length !== 1) {
    return { ok: false, reason: "missing, duplicated, embedded, or malformed marker" };
  }

  const issue = Number(matches[0][1]);
  const run = Number(matches[0][2]);
  const branch = String(headRef ?? "").match(IMPLEMENT_BRANCH);
  if (!branch || Number(branch[1]) !== issue) {
    return { ok: false, reason: "implementation branch does not match marker issue" };
  }

  return { ok: true, issue, run };
}

export function evaluatePostMergeCleanup(pull, repository, issueNumber) {
  if (!Number.isSafeInteger(issueNumber) || issueNumber < 1) {
    return { ok: false, reason: "invalid source issue for post-merge cleanup" };
  }
  if (pull?.head?.repo?.full_name !== repository) {
    return { ok: false, reason: "refusing to delete a fork or cross-repository head" };
  }

  const headRef = String(pull?.head?.ref ?? "");
  const branch = headRef.match(IMPLEMENT_BRANCH);
  if (!branch || Number(branch[1]) !== issueNumber) {
    return {
      ok: false,
      reason: "refusing to delete a non-matching implementation head",
    };
  }

  return {
    ok: true,
    issue: issueNumber,
    headRef,
    gitRef: `heads/${headRef}`,
  };
}

async function getExactRef(github, owner, repo, gitRef) {
  try {
    const { data } = await github.rest.git.getRef({ owner, repo, ref: gitRef });
    if (data?.ref !== `refs/${gitRef}`) {
      throw new Error(`GitHub returned an unexpected ref for ${gitRef}`);
    }
    return data;
  } catch (error) {
    if (error?.status === 404) return null;
    throw error;
  }
}

export async function completePostMergeCleanup({
  github,
  owner,
  repo,
  pull,
  repository,
  issueNumber,
}) {
  const target = evaluatePostMergeCleanup(pull, repository, issueNumber);
  if (!target.ok) throw new Error(target.reason);

  const { data: currentIssue } = await github.rest.issues.get({
    owner,
    repo,
    issue_number: target.issue,
  });
  if (currentIssue?.pull_request || !["open", "closed"].includes(currentIssue?.state)) {
    throw new Error(`Source #${target.issue} is no longer a closable issue`);
  }

  const issueAlreadyClosed = currentIssue.state === "closed";
  if (!issueAlreadyClosed) {
    await github.rest.issues.update({
      owner,
      repo,
      issue_number: target.issue,
      state: "closed",
    });
  }
  const { data: confirmedIssue } = await github.rest.issues.get({
    owner,
    repo,
    issue_number: target.issue,
  });
  if (confirmedIssue?.state !== "closed") {
    throw new Error(`Source issue #${target.issue} did not reach the closed state`);
  }

  const existingRef = await getExactRef(github, owner, repo, target.gitRef);
  const headAlreadyDeleted = existingRef === null;
  if (!headAlreadyDeleted) {
    try {
      await github.rest.git.deleteRef({
        owner,
        repo,
        ref: target.gitRef,
      });
    } catch (error) {
      if (await getExactRef(github, owner, repo, target.gitRef)) throw error;
    }
  }
  if (await getExactRef(github, owner, repo, target.gitRef)) {
    throw new Error(`Implementation head ref ${target.headRef} still exists`);
  }

  return { ...target, issueAlreadyClosed, headAlreadyDeleted };
}

export async function dispatchPostMergeWorkflows({
  github,
  owner,
  repo,
  repository,
  defaultBranch,
  pullNumber,
  mergeSha,
}) {
  if (!SHA.test(String(mergeSha ?? ""))) {
    throw new Error("invalid squash merge SHA for post-merge dispatch");
  }

  const [{ data: mergedPull }, { data: defaultRef }] = await Promise.all([
    github.rest.pulls.get({
      owner,
      repo,
      pull_number: pullNumber,
    }),
    github.rest.git.getRef({
      owner,
      repo,
      ref: `heads/${defaultBranch}`,
    }),
  ]);

  if (
    mergedPull?.number !== pullNumber ||
    mergedPull?.state !== "closed" ||
    mergedPull?.merged !== true ||
    mergedPull?.merge_commit_sha !== mergeSha ||
    mergedPull?.base?.ref !== defaultBranch ||
    mergedPull?.base?.repo?.full_name !== repository
  ) {
    throw new Error(`PR #${pullNumber} did not refetch as the expected squash merge`);
  }
  if (
    defaultRef?.ref !== `refs/heads/${defaultBranch}` ||
    defaultRef?.object?.sha !== mergeSha
  ) {
    throw new Error(
      `default branch advanced or did not reach squash merge SHA ${mergeSha}`,
    );
  }

  await github.rest.actions.createWorkflowDispatch({
    owner,
    repo,
    workflow_id: "factory-controller.lock.yml",
    ref: defaultBranch,
  });
  await github.rest.actions.createWorkflowDispatch({
    owner,
    repo,
    workflow_id: "deploy.yml",
    ref: defaultBranch,
    inputs: {
      operation: "deploy",
      deployment_sha: mergeSha,
    },
  });

  return { mergeSha, workflows: ["factory-controller.lock.yml", "deploy.yml"] };
}

export function evaluateSquadReview(reviews, headSha) {
  if (!SHA.test(String(headSha ?? ""))) {
    return { ok: false, reason: "invalid head SHA" };
  }

  const marker = `Squad-Review-Head: ${headSha}`;
  const matching = (reviews ?? []).filter(
    (review) =>
      review?.user?.login === "github-actions[bot]" &&
      review?.commit_id === headSha &&
      lines(review?.body).includes(marker),
  );

  if (matching.some((review) => review.state === "CHANGES_REQUESTED")) {
    return { ok: false, reason: "Squad requested changes for the current head" };
  }
  if (!matching.some((review) => review.state === "COMMENTED")) {
    return { ok: false, reason: "no current-head COMMENT Squad review" };
  }

  return { ok: true };
}

export function evaluateChecks(checkRuns, required = REQUIRED_CHECKS) {
  const latest = new Map();
  for (const run of checkRuns ?? []) {
    const name = run?.name ?? run?.context;
    if (!required.includes(name)) continue;
    const normalized = {
      ...run,
      name,
      status:
        run.status ??
        (run.state === "pending" ? "in_progress" : "completed"),
      conclusion:
        run.conclusion ??
        (run.state === "pending" ? null : run.state),
    };
    const previous = latest.get(name);
    if (!previous || Number(normalized.id) > Number(previous.id)) {
      latest.set(name, normalized);
    }
  }

  const missing = required.filter((name) => !latest.has(name));
  if (missing.length) {
    return { ok: false, reason: `missing checks: ${missing.join(", ")}` };
  }

  const unsuccessful = required.filter((name) => {
    const run = latest.get(name);
    return run.status !== "completed" || run.conclusion !== "success";
  });
  if (unsuccessful.length) {
    return { ok: false, reason: `unsuccessful checks: ${unsuccessful.join(", ")}` };
  }

  return { ok: true };
}

export function evaluateSourceIssue(issue) {
  if (!issue || issue.pull_request || !["open", "closed"].includes(issue.state)) {
    return { ok: false, reason: "source number is not an issue in this repository" };
  }
  const labels = (issue.labels ?? []).map((label) =>
    typeof label === "string" ? label : label?.name,
  );
  if (!labels.some((label) => String(label ?? "").startsWith("squad:"))) {
    return { ok: false, reason: "source issue has no squad: label" };
  }
  return { ok: true };
}

export function isEligiblePullRequest(pull, repository, defaultBranch = "main") {
  return Boolean(
    pull &&
      pull.state === "open" &&
      pull.draft === false &&
      pull.base?.ref === defaultBranch &&
      pull.base?.repo?.full_name === repository &&
      pull.head?.repo?.full_name === repository,
  );
}

function updateIdentityGate(
  pull,
  repository,
  defaultBranch,
  pullNumber,
  expectedHeadSha,
  expectedIssue,
) {
  if (
    pull?.number !== pullNumber ||
    !isEligiblePullRequest(pull, repository, defaultBranch)
  ) {
    return { ok: false, reason: "pull request identity or eligibility changed" };
  }
  if (pull.head?.sha !== expectedHeadSha) {
    return { ok: false, reason: "pull request head changed" };
  }

  const marker = parseImplementationMarker(pull.body, pull.head.ref);
  if (!marker.ok || marker.issue !== expectedIssue) {
    return { ok: false, reason: "implementation marker or branch identity changed" };
  }

  return { ok: true };
}

export async function updateBehindPullRequest({
  github,
  owner,
  repo,
  repository,
  defaultBranch = "main",
  pullNumber,
  expectedHeadSha,
  expectedIssue,
  sleep = (milliseconds) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds)),
  postconditionAttempts = 10,
}) {
  if (!SHA.test(String(expectedHeadSha ?? ""))) {
    throw new Error("invalid expected head SHA for branch update");
  }
  if (
    !Number.isSafeInteger(pullNumber) ||
    pullNumber < 1 ||
    !Number.isSafeInteger(expectedIssue) ||
    expectedIssue < 1
  ) {
    throw new Error("invalid pull request or source issue for branch update");
  }

  const getPull = async () => {
    const { data } = await github.rest.pulls.get({
      owner,
      repo,
      pull_number: pullNumber,
    });
    return data;
  };

  const fresh = await getPull();
  const identity = updateIdentityGate(
    fresh,
    repository,
    defaultBranch,
    pullNumber,
    expectedHeadSha,
    expectedIssue,
  );
  if (!identity.ok) throw new Error(identity.reason);
  if (fresh.mergeable_state !== "behind") {
    return { updated: false, pull: fresh };
  }

  try {
    await github.rest.pulls.updateBranch({
      owner,
      repo,
      pull_number: pullNumber,
      expected_head_sha: expectedHeadSha,
    });
  } catch (error) {
    if (error?.status !== 422) throw error;

    const raced = await getPull();
    if (
      raced.head?.sha !== expectedHeadSha ||
      raced.mergeable_state !== "behind"
    ) {
      return { updated: true, pull: raced, raced: true };
    }
    throw new Error(
      `PR #${pullNumber} branch update returned 422 and remains behind at ${expectedHeadSha}`,
      { cause: error },
    );
  }

  for (let attempt = 0; attempt < postconditionAttempts; attempt += 1) {
    if (attempt > 0) await sleep(1000);
    const updated = await getPull();
    if (updated.head?.sha !== expectedHeadSha) {
      return { updated: true, pull: updated, raced: false };
    }
  }

  throw new Error(
    `PR #${pullNumber} branch update was accepted but the head did not change from ${expectedHeadSha}`,
  );
}
