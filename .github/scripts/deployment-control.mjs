import { readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const SHA = /^[0-9a-f]{40}$/;
const DEPLOYMENT_IDENTITY = /^[A-Za-z0-9._-]{1,128}$/;

function required(value, name) {
  const result = String(value ?? "").trim();
  if (!result) throw new Error(`${name} is required`);
  return result;
}

export function exactSha(value, name = "SHA") {
  const result = required(value, name);
  if (!SHA.test(result)) {
    throw new Error(`${name} must be a lowercase 40-character SHA`);
  }
  return result;
}

export function selectDeploymentSha({
  eventName,
  event,
  repository,
  defaultBranch,
  dispatchSha,
  currentDefaultSha,
}) {
  const currentSha = exactSha(currentDefaultSha, "current default-branch SHA");
  let candidate;

  if (eventName === "workflow_run") {
    if (
      event?.workflow_run?.conclusion !== "success" ||
      event?.workflow_run?.head_branch !== defaultBranch ||
      event?.workflow_run?.head_repository?.full_name !== repository
    ) {
      throw new Error("workflow_run is not a successful same-repository default-branch run");
    }
    candidate = exactSha(event.workflow_run.head_sha, "workflow_run head SHA");
  } else if (eventName === "workflow_dispatch") {
    candidate = exactSha(dispatchSha, "deployment_sha");
  } else {
    throw new Error(`unsupported deployment event: ${eventName}`);
  }

  if (candidate !== currentSha) {
    throw new Error(
      `deployment SHA is stale: requested ${candidate}, current ${defaultBranch} is ${currentSha}`,
    );
  }
  return candidate;
}

export function selectDeploymentOperation({
  eventName,
  dispatchOperation,
  deployEnabled,
}) {
  if (eventName === "workflow_run") {
    if (!deployEnabled) throw new Error("deployment is disabled");
    return "deploy";
  }
  if (eventName !== "workflow_dispatch") {
    throw new Error(`unsupported deployment event: ${eventName}`);
  }
  if (dispatchOperation === "preflight") return "preflight";
  if (dispatchOperation === "deploy") {
    if (!deployEnabled) throw new Error("deployment is disabled");
    return "deploy";
  }
  throw new Error(`unsupported workflow_dispatch operation: ${dispatchOperation}`);
}

export function parseHealthPayload(body, expectedSha) {
  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    throw new Error("health response is not valid JSON");
  }
  if (
    !payload ||
    Array.isArray(payload) ||
    payload.status !== "ok" ||
    typeof payload.deploymentSha !== "string" ||
    !DEPLOYMENT_IDENTITY.test(payload.deploymentSha)
  ) {
    throw new Error(
      "health response must contain status=ok and a safe deploymentSha identity",
    );
  }
  if (expectedSha !== undefined && payload.deploymentSha !== expectedSha) {
    throw new Error(
      `health deploymentSha mismatch: expected ${expectedSha}, received ${payload.deploymentSha}`,
    );
  }
  return { status: "ok", deploymentSha: payload.deploymentSha };
}

export async function fetchHealth(url, expectedSha, fetchImpl = fetch) {
  const response = await fetchImpl(url, {
    headers: { accept: "application/json" },
    redirect: "error",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new Error(`health request returned HTTP ${response.status}`);
  }
  return parseHealthPayload(await response.text(), expectedSha);
}

export async function pollHealth({
  url,
  expectedSha,
  attempts = 12,
  delayMs = 10_000,
  fetchImpl = fetch,
  sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fetchHealth(url, expectedSha, fetchImpl);
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await sleep(delayMs);
    }
  }
  throw new Error(
    `health verification failed after ${attempts} attempts: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`,
  );
}

export async function runSlotDeployment({
  expectedSha,
  previousProduction,
  checkStaging,
  checkProduction,
  captureState,
  swap,
}) {
  if (previousProduction.deploymentSha === expectedSha) {
    return { outcome: "already_deployed", swaps: 0, rollbacks: 0 };
  }

  await checkStaging(expectedSha);
  await captureState();
  await swap();

  try {
    await checkProduction(expectedSha);
    return { outcome: "deployed", swaps: 1, rollbacks: 0 };
  } catch (productionError) {
    try {
      await swap();
    } catch (rollbackError) {
      throw new Error(
        `ROLLBACK FAILED after production verification failure: ${
          rollbackError instanceof Error ? rollbackError.message : String(rollbackError)
        }`,
        { cause: productionError },
      );
    }

    try {
      await checkProduction(previousProduction.deploymentSha);
    } catch (rollbackVerificationError) {
      throw new Error(
        `ROLLBACK FAILED verification: ${
          rollbackVerificationError instanceof Error
            ? rollbackVerificationError.message
            : String(rollbackVerificationError)
        }`,
        { cause: productionError },
      );
    }

    throw new Error("production verification failed; rollback completed and was verified", {
      cause: productionError,
    });
  }
}

export function deploymentStatusForResults({ resolve, build, deploy }) {
  if (resolve === "success" && build === "success" && deploy === "success") {
    return {
      state: "success",
      description: "Exact deployment SHA is verified in production",
    };
  }
  if ([resolve, build, deploy].includes("cancelled")) {
    return { state: "error", description: "Deployment workflow was cancelled" };
  }
  return { state: "failure", description: "Deployment failed or was rolled back" };
}

function argument(name, args) {
  const index = args.indexOf(`--${name}`);
  if (index === -1 || index === args.length - 1) {
    throw new Error(`--${name} is required`);
  }
  return args[index + 1];
}

function optionalArgument(name, args, fallback) {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? fallback : args[index + 1];
}

function healthUrl(baseUrl, healthPath) {
  const base = new URL(required(baseUrl, "base URL"));
  if (base.protocol !== "https:" && base.hostname !== "127.0.0.1") {
    throw new Error("health base URL must use HTTPS");
  }
  if (base.username || base.password) {
    throw new Error("health base URL must not contain credentials");
  }
  if (!healthPath.startsWith("/")) throw new Error("health path must start with /");
  return new URL(healthPath, `${base.origin}/`).href;
}

function runAz(args) {
  const result = spawnSync("az", args, {
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(`Azure CLI command failed with exit code ${result.status ?? "unknown"}`);
  }
  return result.stdout.trim();
}

async function appendOutput(name, value) {
  const outputPath = required(process.env.GITHUB_OUTPUT, "GITHUB_OUTPUT");
  await writeFile(outputPath, `${name}=${value}\n`, { flag: "a" });
}

async function commandResolve(args) {
  const event = JSON.parse(await readFile(argument("event", args), "utf8"));
  const eventName = argument("event-name", args);
  const sha = selectDeploymentSha({
    eventName,
    event,
    repository: argument("repository", args),
    defaultBranch: argument("default-branch", args),
    dispatchSha: optionalArgument("dispatch-sha", args, ""),
    currentDefaultSha: argument("current-default-sha", args),
  });
  const operation = selectDeploymentOperation({
    eventName,
    dispatchOperation: optionalArgument("operation", args, ""),
    deployEnabled: optionalArgument("deploy-enabled", args, "false") === "true",
  });
  await appendOutput("deployment_sha", sha);
  await appendOutput("operation", operation);
  console.log(`Selected current default-branch SHA ${sha} for ${operation}.`);
}

async function commandProbe(args) {
  const health = await pollHealth({
    url: healthUrl(argument("base-url", args), argument("health-path", args)),
    attempts: Number(optionalArgument("attempts", args, "3")),
    delayMs: Number(optionalArgument("delay-ms", args, "2000")),
  });
  console.log(`Health endpoint is valid and reports deployment identity ${health.deploymentSha}.`);
}

async function commandInspect(args) {
  const expectedSha = exactSha(argument("expected-sha", args), "expected SHA");
  const production = await pollHealth({
    url: healthUrl(argument("base-url", args), argument("health-path", args)),
    attempts: Number(optionalArgument("attempts", args, "3")),
    delayMs: Number(optionalArgument("delay-ms", args, "2000")),
  });
  await appendOutput("already_deployed", String(production.deploymentSha === expectedSha));
  await appendOutput("previous_sha", production.deploymentSha);
  console.log(
    production.deploymentSha === expectedSha
      ? "Production already serves the expected deployment SHA."
      : "Production is healthy and its current deployment identity was captured.",
  );
}

async function commandOrchestrate(args) {
  const expectedSha = exactSha(argument("expected-sha", args), "expected SHA");
  const previousSha = required(argument("previous-sha", args), "previous production SHA");
  const resourceGroup = argument("resource-group", args);
  const appName = argument("app-name", args);
  const healthPath = argument("health-path", args);
  const stagingUrl = healthUrl(argument("staging-url", args), healthPath);
  const productionUrl = healthUrl(argument("production-url", args), healthPath);
  const stateFile = argument("state-file", args);
  const attempts = Number(optionalArgument("attempts", args, "12"));
  const delayMs = Number(optionalArgument("delay-ms", args, "10000"));

  const check = (url, sha) =>
    pollHealth({ url, expectedSha: sha, attempts, delayMs });
  const previousProduction = { status: "ok", deploymentSha: previousSha };

  const result = await runSlotDeployment({
    expectedSha,
    previousProduction,
    checkStaging: (sha) => check(stagingUrl, sha),
    checkProduction: (sha) => check(productionUrl, sha),
    captureState: async () => {
      const [productionSlot, stagingSlot] = ["production", "staging"].map((slot) => {
        const slotArgs =
          slot === "production"
            ? []
            : ["--slot", slot];
        const output = runAz([
          "webapp",
          "show",
          "--resource-group",
          resourceGroup,
          "--name",
          appName,
          ...slotArgs,
          "--query",
          "{name:name,state:state,enabled:enabled,hostNames:hostNames}",
          "--output",
          "json",
          "--only-show-errors",
        ]);
        return JSON.parse(output);
      });
      await writeFile(
        stateFile,
        `${JSON.stringify(
          {
            capturedAt: new Date().toISOString(),
            expectedSha,
            production: { ...productionSlot, health: previousProduction },
            staging: {
              ...stagingSlot,
              health: { status: "ok", deploymentSha: expectedSha },
            },
          },
          null,
          2,
        )}\n`,
      );
    },
    swap: async () => {
      runAz([
        "webapp",
        "deployment",
        "slot",
        "swap",
        "--resource-group",
        resourceGroup,
        "--name",
        appName,
        "--slot",
        "staging",
        "--target-slot",
        "production",
        "--only-show-errors",
      ]);
    },
  });
  console.log(`Deployment orchestration completed with outcome: ${result.outcome}.`);
}

async function commandStatus(args) {
  const status = deploymentStatusForResults({
    resolve: argument("resolve", args),
    build: argument("build", args),
    deploy: argument("deploy", args),
  });
  await appendOutput("state", status.state);
  await appendOutput("description", status.description);
}

async function main(args) {
  const command = args.shift();
  if (command === "resolve") return commandResolve(args);
  if (command === "probe") return commandProbe(args);
  if (command === "inspect") return commandInspect(args);
  if (command === "orchestrate") return commandOrchestrate(args);
  if (command === "status") return commandStatus(args);
  throw new Error(`unknown deployment-control command: ${command ?? "(missing)"}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(`::error::${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
