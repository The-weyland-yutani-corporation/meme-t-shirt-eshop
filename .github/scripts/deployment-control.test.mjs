import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  deploymentStatusForResults,
  fetchHealth,
  fetchReachability,
  fetchSeoMetadata,
  healthUrl,
  inspectProduction,
  parseHealthPayload,
  pollReachability,
  productionSiteUrl,
  runSlotDeployment,
  selectDeploymentOperation,
  selectDeploymentSha,
} from "./deployment-control.mjs";

const oldSha = "a".repeat(40);
const newSha = "b".repeat(40);
const deploymentWorkflow = readFileSync(
  new URL("../workflows/deploy.yml", import.meta.url),
  "utf8",
);
const robotsRoute = readFileSync(
  new URL("../../app/robots.ts", import.meta.url),
  "utf8",
);
const sitemapRoute = readFileSync(
  new URL("../../app/sitemap.ts", import.meta.url),
  "utf8",
);

function workflowRunEvent(overrides = {}) {
  return {
    workflow_run: {
      conclusion: "success",
      head_branch: "main",
      head_sha: newSha,
      head_repository: { full_name: "owner/repo" },
      ...overrides,
    },
  };
}

test("selects only the exact current main SHA", () => {
  assert.equal(
    selectDeploymentSha({
      eventName: "workflow_run",
      event: workflowRunEvent(),
      repository: "owner/repo",
      defaultBranch: "main",
      currentDefaultSha: newSha,
    }),
    newSha,
  );
  assert.equal(
    selectDeploymentSha({
      eventName: "workflow_dispatch",
      event: {},
      repository: "owner/repo",
      defaultBranch: "main",
      dispatchSha: newSha,
      currentDefaultSha: newSha,
    }),
    newSha,
  );
});

test("fails closed on stale or invalid deployment SHAs", () => {
  assert.throws(
    () =>
      selectDeploymentSha({
        eventName: "workflow_dispatch",
        event: {},
        repository: "owner/repo",
        defaultBranch: "main",
        dispatchSha: oldSha,
        currentDefaultSha: newSha,
      }),
    /stale/,
  );
  assert.throws(
    () =>
      selectDeploymentSha({
        eventName: "workflow_run",
        event: workflowRunEvent({ head_repository: { full_name: "fork/repo" } }),
        repository: "owner/repo",
        defaultBranch: "main",
        currentDefaultSha: newSha,
      }),
    /same-repository/,
  );
});

test("preflight is safe while deployment remains disabled", () => {
  assert.equal(
    selectDeploymentOperation({
      eventName: "workflow_dispatch",
      dispatchOperation: "preflight",
      deployEnabled: false,
    }),
    "preflight",
  );
  assert.throws(
    () =>
      selectDeploymentOperation({
        eventName: "workflow_dispatch",
        dispatchOperation: "deploy",
        deployEnabled: false,
      }),
    /disabled/,
  );
  assert.throws(
    () =>
      selectDeploymentOperation({
        eventName: "workflow_run",
        dispatchOperation: "",
        deployEnabled: false,
      }),
    /disabled/,
  );
  assert.equal(
    selectDeploymentOperation({
      eventName: "workflow_run",
      dispatchOperation: "",
      deployEnabled: true,
    }),
    "deploy",
  );
});

test("accepts a healthy payload with the expected SHA", () => {
  assert.deepEqual(
    parseHealthPayload(JSON.stringify({ status: "ok", deploymentSha: newSha }), newSha),
    { status: "ok", deploymentSha: newSha },
  );
});

test("rejects HTTP 200 responses with the wrong SHA", async () => {
  await assert.rejects(
    fetchHealth(
      "https://example.test/api/health",
      newSha,
      async () =>
        new Response(JSON.stringify({ status: "ok", deploymentSha: oldSha }), {
          status: 200,
        }),
    ),
    /mismatch/,
  );
});

test("rejects malformed HTTP 200 health payloads", async () => {
  await assert.rejects(
    fetchHealth(
      "https://example.test/api/health",
      newSha,
      async () => new Response("<html>ok</html>", { status: 200 }),
    ),
    /valid JSON/,
  );
  assert.throws(
    () => parseHealthPayload(JSON.stringify({ status: "degraded", deploymentSha: newSha }), newSha),
    /status=ok/,
  );
  assert.throws(
    () => parseHealthPayload(JSON.stringify({ status: "ok", deploymentSha: "bad\noutput" })),
    /safe deploymentSha/,
  );
});

test("live SEO verification uses cache-busted requests and rejects stale metadata", async () => {
  const requests = [];
  const fetchImpl = async (url, options) => {
    requests.push({ url: String(url), options });
    if (String(url).includes("robots.txt")) {
      return new Response(
        "User-Agent: *\nAllow: /\n\nSitemap: https://shop.example.test/sitemap.xml\n",
      );
    }
    return new Response(
      "<urlset><url><loc>https://shop.example.test/</loc></url></urlset>",
    );
  };
  await fetchSeoMetadata({
    baseUrl: "https://staging.example.test",
    expectedSiteUrl: "https://shop.example.test",
    cacheKey: newSha,
    fetchImpl,
  });
  assert.equal(requests.length, 2);
  assert.ok(requests.every(({ url }) => url.includes(`deployment=${newSha}`)));
  assert.ok(
    requests.every(({ options }) => options.headers["cache-control"] === "no-cache"),
  );

  await assert.rejects(
    fetchSeoMetadata({
      baseUrl: "https://staging.example.test",
      expectedSiteUrl: "https://shop.example.test",
      cacheKey: newSha,
      fetchImpl: async (url) =>
        new Response(
          String(url).includes("robots.txt")
            ? "Sitemap: https://example-redacted.invalid/sitemap.xml"
            : "<urlset><url><loc>https://example-redacted.invalid/</loc></url></urlset>",
        ),
    }),
    /robots\.txt does not reference/,
  );

  await assert.rejects(
    fetchSeoMetadata({
      baseUrl: "https://staging.example.test",
      expectedSiteUrl: "https://shop.example.test",
      cacheKey: newSha,
      fetchImpl: async (url) =>
        new Response(
          String(url).includes("robots.txt")
            ? "Sitemap: https://shop.example.test/sitemap.xml"
            : "<urlset><url><loc>https://example-redacted.invalid/</loc></url></urlset>",
        ),
    }),
    /sitemap\.xml contains a URL outside/,
  );
});

test("first-deployment inspect accepts a completed HTTP 404 as undeployed", async () => {
  assert.deepEqual(
    await inspectProduction(
      "https://example.test/api/health",
      newSha,
      async () => new Response("not deployed", { status: 404 }),
    ),
    { status: "undeployed", httpStatus: 404, alreadyDeployed: false },
  );
});

test("first-deployment inspect only marks an exact healthy SHA as already deployed", async () => {
  assert.deepEqual(
    await inspectProduction(
      "https://example.test/api/health",
      newSha,
      async () =>
        new Response(JSON.stringify({ status: "ok", deploymentSha: newSha }), {
          status: 200,
        }),
    ),
    { status: "ok", deploymentSha: newSha, alreadyDeployed: true },
  );
  assert.deepEqual(
    await inspectProduction(
      "https://example.test/api/health",
      newSha,
      async () =>
        new Response(JSON.stringify({ status: "ok", deploymentSha: oldSha }), {
          status: 200,
        }),
    ),
    { status: "ok", deploymentSha: oldSha, alreadyDeployed: false },
  );
});

test("first-deployment inspect rejects malformed successful health payloads", async () => {
  await assert.rejects(
    inspectProduction(
      "https://example.test/api/health",
      newSha,
      async () => new Response("<html>ok</html>", { status: 200 }),
    ),
    /valid JSON/,
  );
});

test("first-deployment inspect fails on DNS, TLS, or network errors", async () => {
  await assert.rejects(
    inspectProduction(
      "https://unreachable.example/api/health",
      newSha,
      async () => {
        throw new TypeError("fetch failed");
      },
    ),
    /fetch failed/,
  );
});

test("first-deployment inspect fails on request timeouts", async () => {
  await assert.rejects(
    inspectProduction(
      "https://example.test/api/health",
      newSha,
      async () => {
        throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
      },
    ),
    /timeout/i,
  );
});

test("first-deployment preflight accepts a reachable HTTP 404", async () => {
  assert.deepEqual(
    await fetchReachability(
      "https://example.test/api/health",
      async () => new Response("not deployed", { status: 404 }),
    ),
    { status: 404 },
  );
});

test("first-deployment preflight fails on DNS, TLS, or network errors", async () => {
  let attempts = 0;
  await assert.rejects(
    pollReachability({
      url: "https://unreachable.example/api/health",
      attempts: 3,
      delayMs: 0,
      fetchImpl: async () => {
        attempts += 1;
        throw new TypeError("fetch failed");
      },
      sleep: async () => {},
    }),
    /URL reachability failed after 3 attempts: fetch failed/,
  );
  assert.equal(attempts, 3);
});

test("first-deployment preflight fails closed on invalid URL configuration", () => {
  assert.throws(
    () => healthUrl("http://example.test", "/api/health"),
    /must use HTTPS/,
  );
  assert.throws(
    () => healthUrl("https://user:password@example.test", "/api/health"),
    /must not contain credentials/,
  );
  assert.throws(
    () => healthUrl("https://example.test", "api/health"),
    /must start with \//,
  );
});

test("production site URL accepts only a canonical HTTPS origin", () => {
  assert.equal(
    productionSiteUrl("https://memeteeshop-df-82889e2d.azurewebsites.net"),
    "https://memeteeshop-df-82889e2d.azurewebsites.net",
  );
  assert.throws(() => productionSiteUrl(""), /is required/);
  assert.throws(() => productionSiteUrl("http://example.test"), /must use HTTPS/);
  assert.throws(
    () => productionSiteUrl("https://user:pass@example.test"),
    /must not contain credentials/,
  );
  assert.throws(
    () => productionSiteUrl("https://example.test/store"),
    /without a path, query, or fragment/,
  );
});

test("deployment workflow uses the verified build path and configures the runtime URL", () => {
  assert.match(
    deploymentWorkflow,
    /- name: Build and verify Next\.js application[\s\S]*?NEXT_PUBLIC_SITE_URL: \$\{\{ vars\.AZURE_PRODUCTION_URL \}\}[\s\S]*?deployment-build\.mjs[\s\S]*?--site-url "\$NEXT_PUBLIC_SITE_URL"/,
  );
  assert.match(
    deploymentWorkflow,
    /- name: Configure staging deployment settings[\s\S]*?NEXT_PUBLIC_SITE_URL: \$\{\{ vars\.AZURE_PRODUCTION_URL \}\}[\s\S]*?NEXT_PUBLIC_SITE_URL="\$NEXT_PUBLIC_SITE_URL"/,
  );
});

test("SEO metadata routes always bypass persistent static output", () => {
  for (const route of [robotsRoute, sitemapRoute]) {
    assert.match(route, /export const dynamic = "force-dynamic"/);
    assert.match(route, /export const revalidate = 0/);
  }
});

function operations({ stagingFails = false, productionFails = false, rollbackFails = false } = {}) {
  const calls = [];
  let swapCount = 0;
  return {
    calls,
    checkStaging: async () => {
      calls.push("check-staging");
      if (stagingFails) throw new Error("staging unhealthy");
    },
    checkProduction: async (sha) => {
      calls.push(`check-production:${sha}`);
      if (productionFails && sha === newSha) throw new Error("production unhealthy");
    },
    checkPreviousProduction: async (previous) => {
      calls.push(
        `check-previous:${previous.status}:${previous.deploymentSha ?? previous.httpStatus}`,
      );
      if (rollbackFails) throw new Error("old production not restored");
    },
    captureState: async () => calls.push("capture-state"),
    swap: async () => {
      swapCount += 1;
      calls.push(`swap:${swapCount}`);
      if (rollbackFails && swapCount === 2) throw new Error("rollback swap rejected");
    },
  };
}

test("healthy deployment verifies staging, swaps once, and verifies production", async () => {
  const ops = operations();
  const result = await runSlotDeployment({
    expectedSha: newSha,
    previousProduction: { status: "ok", deploymentSha: oldSha },
    ...ops,
  });
  assert.deepEqual(result, { outcome: "deployed", swaps: 1, rollbacks: 0 });
  assert.deepEqual(ops.calls, [
    "check-staging",
    "capture-state",
    "swap:1",
    `check-production:${newSha}`,
  ]);
});

test("staging failure prevents any swap", async () => {
  const ops = operations({ stagingFails: true });
  await assert.rejects(
    runSlotDeployment({
      expectedSha: newSha,
      previousProduction: { status: "ok", deploymentSha: oldSha },
      ...ops,
    }),
    /staging unhealthy/,
  );
  assert.deepEqual(ops.calls, ["check-staging"]);
});

test("production failure performs exactly one rollback and verifies it", async () => {
  const ops = operations({ productionFails: true });
  await assert.rejects(
    runSlotDeployment({
      expectedSha: newSha,
      previousProduction: { status: "ok", deploymentSha: oldSha },
      ...ops,
    }),
    /rollback completed and was verified/,
  );
  assert.deepEqual(ops.calls, [
    "check-staging",
    "capture-state",
    "swap:1",
    `check-production:${newSha}`,
    "swap:2",
    `check-previous:ok:${oldSha}`,
  ]);
});

test("first deployment rollback verifies the prior undeployed HTTP state", async () => {
  const ops = operations({ productionFails: true });
  await assert.rejects(
    runSlotDeployment({
      expectedSha: newSha,
      previousProduction: { status: "undeployed", httpStatus: 404 },
      ...ops,
    }),
    /rollback completed and was verified/,
  );
  assert.deepEqual(ops.calls, [
    "check-staging",
    "capture-state",
    "swap:1",
    `check-production:${newSha}`,
    "swap:2",
    "check-previous:undeployed:404",
  ]);
});

test("rollback failure is surfaced explicitly and is not retried", async () => {
  const ops = operations({ productionFails: true, rollbackFails: true });
  await assert.rejects(
    runSlotDeployment({
      expectedSha: newSha,
      previousProduction: { status: "ok", deploymentSha: oldSha },
      ...ops,
    }),
    /ROLLBACK FAILED/,
  );
  assert.equal(ops.calls.filter((call) => call.startsWith("swap:")).length, 2);
});

test("idempotent rerun verifies live production before skipping deployment", async () => {
  const ops = operations();
  const result = await runSlotDeployment({
    expectedSha: newSha,
    previousProduction: { status: "ok", deploymentSha: newSha },
    ...ops,
  });
  assert.deepEqual(result, { outcome: "already_deployed", swaps: 0, rollbacks: 0 });
  assert.deepEqual(ops.calls, [`check-production:${newSha}`]);
});

test("same-SHA deployment replaces stale production content", async () => {
  const ops = operations({ productionFails: true });
  let productionChecks = 0;
  ops.checkProduction = async (sha) => {
    productionChecks += 1;
    ops.calls.push(`check-production:${sha}`);
    if (productionChecks === 1) throw new Error("stale SEO metadata");
  };
  const result = await runSlotDeployment({
    expectedSha: newSha,
    previousProduction: { status: "ok", deploymentSha: newSha },
    ...ops,
  });
  assert.deepEqual(result, { outcome: "deployed", swaps: 1, rollbacks: 0 });
  assert.deepEqual(ops.calls, [
    `check-production:${newSha}`,
    "check-staging",
    "capture-state",
    "swap:1",
    `check-production:${newSha}`,
  ]);
});

test("deployment evidence distinguishes success, failure, and cancellation", () => {
  assert.equal(
    deploymentStatusForResults({ resolve: "success", build: "success", deploy: "success" }).state,
    "success",
  );
  assert.equal(
    deploymentStatusForResults({ resolve: "success", build: "failure", deploy: "skipped" }).state,
    "failure",
  );
  assert.equal(
    deploymentStatusForResults({ resolve: "success", build: "success", deploy: "cancelled" }).state,
    "error",
  );
});
