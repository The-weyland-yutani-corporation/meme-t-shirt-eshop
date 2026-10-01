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

export function evaluatePromotionEvidence(pull, repository, checkRuns, reviews) {
  const candidate = evaluateContinuationPull(pull, repository);
  if (!candidate.ok) return candidate;
  if (!candidate.implementation) {
    return { ok: false, reason: "dependency PRs are not autonomously promoted" };
  }

  const checks = evaluateChecks(checkRuns);
  if (!checks.ok) return checks;
  return evaluateSquadReview(reviews, pull.head.sha);
}

export function hasActiveMergeGateRun(runs, pullNumber) {
  const marker = `PR #${pullNumber}`;
  return (runs ?? []).some(
    (run) =>
      ["queued", "in_progress", "requested", "waiting"].includes(run?.status) &&
      String(run?.display_title ?? "").includes(marker),
  );
}
