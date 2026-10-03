import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  createDeploymentLayout,
  detectPackageMode,
} from "./deployment-package.mjs";

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "deployment-package-"));
  const source = path.join(root, "source");
  const destination = path.join(root, "destination");
  await mkdir(source, { recursive: true });
  return { root, source, destination };
}

async function put(root, relativePath, contents = "") {
  const target = path.join(root, relativePath);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, contents);
}

test("packages standalone output with static and public assets", async (t) => {
  const { root, source, destination } = await fixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  await put(
    source,
    ".next/standalone/package.json",
    JSON.stringify({ scripts: { start: "next start" } }),
  );
  await put(source, ".next/standalone/server.js", "server");
  await put(source, ".next/static/chunk.js", "chunk");
  await put(source, "public/asset.txt", "asset");

  assert.equal(await detectPackageMode(source), "standalone");
  assert.equal(
    await createDeploymentLayout({ sourceDirectory: source, destinationDirectory: destination }),
    "standalone",
  );
  assert.equal(await readFile(path.join(destination, "server.js"), "utf8"), "server");
  assert.equal(await readFile(path.join(destination, ".next/static/chunk.js"), "utf8"), "chunk");
  assert.equal(await readFile(path.join(destination, "public/asset.txt"), "utf8"), "asset");
  const packageJson = JSON.parse(
    await readFile(path.join(destination, "package.json"), "utf8"),
  );
  assert.equal(packageJson.scripts.start, "node server.js");
});

test("packages this repository's next-start layout with production dependencies", async (t) => {
  const { root, source, destination } = await fixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  await put(
    source,
    "package.json",
    JSON.stringify({ scripts: { start: "next start" } }),
  );
  await put(source, "package-lock.json", "{}");
  await put(source, ".next/BUILD_ID", "build-id");
  await put(source, ".next/server/app.js", "app");
  await put(source, "node_modules/next/package.json", "{}");
  await put(source, "node_modules/react/package.json", "{}");
  await put(source, "next.config.ts", "export default {}");
  await put(source, "public/asset.txt", "asset");
  await put(source, ".env", "SECRET=do-not-copy");

  assert.equal(await detectPackageMode(source), "next-start");
  assert.equal(
    await createDeploymentLayout({ sourceDirectory: source, destinationDirectory: destination }),
    "next-start",
  );
  assert.equal(await readFile(path.join(destination, ".next/BUILD_ID"), "utf8"), "build-id");
  assert.equal(
    await readFile(path.join(destination, "node_modules/next/package.json"), "utf8"),
    "{}",
  );
  assert.equal(
    JSON.parse(await readFile(path.join(destination, "package.json"), "utf8")).scripts.start,
    "next start",
  );
  await assert.rejects(readFile(path.join(destination, ".env"), "utf8"), /ENOENT/);
});

test("fails closed when no complete deployable layout exists", async (t) => {
  const { root, source } = await fixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  await put(source, ".next/server/app.js", "incomplete");
  await assert.rejects(detectPackageMode(source), /no deployable Next\.js layout/);
});
