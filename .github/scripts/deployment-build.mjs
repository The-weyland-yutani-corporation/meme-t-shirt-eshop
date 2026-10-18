import { readFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

import { exactSha, productionSiteUrl } from "./deployment-control.mjs";

export async function verifyBuiltSiteMetadata(sourceDirectory, expectedSiteUrl) {
  const siteUrl = productionSiteUrl(expectedSiteUrl);
  const robots = await readFile(
    path.join(sourceDirectory, ".next", "server", "app", "robots.txt.body"),
    "utf8",
  );
  const sitemap = await readFile(
    path.join(sourceDirectory, ".next", "server", "app", "sitemap.xml.body"),
    "utf8",
  );

  if (!robots.includes(`Sitemap: ${siteUrl}/sitemap.xml`)) {
    throw new Error("built robots.txt does not reference the configured production sitemap");
  }
  const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  if (locations.length === 0 || locations.some((location) => !location.startsWith(`${siteUrl}/`))) {
    throw new Error("built sitemap.xml contains a URL outside the configured production origin");
  }
}

export async function runDeploymentBuild({
  sourceDirectory,
  siteUrl,
  deploymentSha,
  spawn = spawnSync,
}) {
  const canonicalSiteUrl = productionSiteUrl(siteUrl);
  const exactDeploymentSha = exactSha(deploymentSha, "deployment SHA");
  const command = process.platform === "win32" ? process.env.ComSpec : "npm";
  const commandArgs =
    process.platform === "win32"
      ? ["/d", "/s", "/c", "npm.cmd", "run", "build"]
      : ["run", "build"];
  const result = spawn(command, commandArgs, {
    cwd: sourceDirectory,
    env: {
      ...process.env,
      DEPLOYMENT_SHA: exactDeploymentSha,
      NEXT_PUBLIC_SITE_URL: canonicalSiteUrl,
    },
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Next.js deployment build failed with exit code ${result.status ?? "unknown"}`);
  }
  await verifyBuiltSiteMetadata(sourceDirectory, canonicalSiteUrl);
}

function argument(name, args) {
  const index = args.indexOf(`--${name}`);
  if (index === -1 || index === args.length - 1) {
    throw new Error(`--${name} is required`);
  }
  return args[index + 1];
}

async function main(args) {
  await runDeploymentBuild({
    sourceDirectory: path.resolve(argument("source", args)),
    siteUrl: argument("site-url", args),
    deploymentSha: argument("deployment-sha", args),
  });
  console.log("Built and verified production site metadata.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(`::error::${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
