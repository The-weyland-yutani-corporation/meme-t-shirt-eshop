import {
  evaluateChecks,
  evaluateSquadReview,
} from "./autonomous-merge-gate.mjs";

const SHA = /^[0-9a-f]{40}$/;

export function evaluateContinuationPull(pull, repository) {
  if (
    pull?.state !== "open" ||
    pull?.head?.repo?.full_name !== repository ||
    !SHA.test(String(pull?.head?.sha ?? ""))
  ) {
    return { ok: false, reason: "not a valid same-repository open PR" };
  }

  const headRef = String(pull.head.ref ?? "");
  if (!/^(?:squad\/implement-|squad\/deps-)/.test(headRef)) {
    return { ok: false, reason: "not a supported Squad continuation branch" };
  }

  return {
    ok: true,
    implementation: headRef.startsWith("squad/implement-"),
  };
}

export function evaluateMergeGateEvidence(pull, repository, checkRuns, reviews) {
  const candidate = evaluateContinuationPull(pull, repository);
  if (!candidate.ok) return candidate;
  if (!candidate.implementation) {
    return {
      ok: false,
      reason: "dependency PRs do not enter the autonomous merge gate",
    };
  }
  if (pull.draft) {
    return {
      ok: false,
      reason: "legacy draft requires one-time operator migration",
    };
  }

  const checks = evaluateChecks(checkRuns);
  if (!checks.ok) return checks;
  return evaluateSquadReview(reviews, pull.head.sha);
}

export function isPendingMergeGateEvidence(result) {
  const reason = String(result?.reason ?? "");
  return (
    reason === "no current-head COMMENT Squad review" ||
    reason.startsWith("missing checks: ")
  );
}

export function hasActiveMergeGateRun(runs, pullNumber) {
  const marker = `PR #${pullNumber}`;
  return (runs ?? []).some(
    (run) =>
      ["queued", "in_progress", "requested", "waiting"].includes(run?.status) &&
      String(run?.display_title ?? "").includes(marker),
  );
}
