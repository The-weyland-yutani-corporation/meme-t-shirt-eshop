import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  runDeploymentBuild,
  verifyBuiltSiteMetadata,
} from "./deployment-build.mjs";

const siteUrl = "https://shop.example.test";
const deploymentSha = "a".repeat(40);

async function writeMetadata(root, origin) {
  const appDirectory = path.join(root, ".next", "server", "app");
  await mkdir(appDirectory, { recursive: true });
  await writeFile(
    path.join(appDirectory, "robots.txt.body"),
    `User-Agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`,
  );
  await writeFile(
    path.join(appDirectory, "sitemap.xml.body"),
    `<urlset><url><loc>${origin}/</loc></url><url><loc>${origin}/catalog</loc></url></urlset>`,
  );
}

test("deployment build invokes npm with the validated production environment", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "deployment-build-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeMetadata(root, siteUrl);
  let invocation;

  await runDeploymentBuild({
    sourceDirectory: root,
    siteUrl,
    deploymentSha,
    spawn(command, args, options) {
      invocation = { command, args, options };
      return {
        status: 0,
        error: undefined,
      };
    },
  });

  assert.match(invocation.command, process.platform === "win32" ? /cmd\.exe$/i : /^npm$/);
  assert.deepEqual(invocation.args.slice(-2), ["run", "build"]);
  assert.equal(invocation.options.cwd, root);
  assert.equal(invocation.options.env.NEXT_PUBLIC_SITE_URL, siteUrl);
  assert.equal(invocation.options.env.DEPLOYMENT_SHA, deploymentSha);
});

test("built metadata verification fails on placeholder output", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "deployment-build-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeMetadata(root, "https://example-redacted.invalid");
  await assert.rejects(
    verifyBuiltSiteMetadata(root, siteUrl),
    /does not reference the configured production sitemap/,
  );
});
