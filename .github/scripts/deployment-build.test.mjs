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

async function writeMetadataManifests(root, prerenderedRoutes = {}) {
  const nextDirectory = path.join(root, ".next");
  await mkdir(nextDirectory, { recursive: true });
  await writeFile(
    path.join(nextDirectory, "app-path-routes-manifest.json"),
    JSON.stringify({
      "/robots.txt/route": "/robots.txt",
      "/sitemap.xml/route": "/sitemap.xml",
    }),
  );
  await writeFile(
    path.join(nextDirectory, "prerender-manifest.json"),
    JSON.stringify({ routes: prerenderedRoutes }),
  );
}

test("deployment build invokes npm with the validated production environment", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "deployment-build-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeMetadataManifests(root);
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

test("built metadata verification rejects persistent static route output", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "deployment-build-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeMetadataManifests(root, {
    "/robots.txt": { initialRevalidateSeconds: false },
  });
  await assert.rejects(
    verifyBuiltSiteMetadata(root, siteUrl),
    /robots\.txt must not be prerendered/,
  );
});
