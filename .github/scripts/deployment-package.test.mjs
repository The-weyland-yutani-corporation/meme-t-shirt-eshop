import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { lstat, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import {
  createDeploymentLayout,
  detectPackageMode,
} from "./deployment-package.mjs";

const execFileAsync = promisify(execFile);

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
    "node node_modules/next/dist/bin/next start",
  );
  await assert.rejects(readFile(path.join(destination, ".env"), "utf8"), /ENOENT/);
});

test("next-start package launches without node_modules/.bin symlink semantics", async (t) => {
  const { root, source, destination } = await fixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  await put(
    source,
    "package.json",
    JSON.stringify({ scripts: { start: "next start" } }),
  );
  await put(source, ".next/BUILD_ID", "build-id");
  await put(source, "node_modules/next/package.json", "{}");
  await put(
    source,
    "node_modules/next/dist/bin/next",
    'require("../server/require-hook"); process.stdout.write("direct-next-entrypoint\\n");',
  );
  await put(
    source,
    "node_modules/next/dist/server/require-hook.js",
    "module.exports = {};",
  );
  await put(
    source,
    "node_modules/.bin/next",
    'require("../server/require-hook");',
  );

  await createDeploymentLayout({
    sourceDirectory: source,
    destinationDirectory: destination,
  });

  assert.equal(
    (await lstat(path.join(destination, "node_modules/.bin/next"))).isSymbolicLink(),
    false,
  );
  const packageJson = JSON.parse(
    await readFile(path.join(destination, "package.json"), "utf8"),
  );
  assert.equal(
    packageJson.scripts.start,
    "node node_modules/next/dist/bin/next start",
  );
  const { stdout } = await execFileAsync(
    process.execPath,
    ["node_modules/next/dist/bin/next", "start"],
    { cwd: destination },
  );
  assert.equal(stdout, "direct-next-entrypoint\n");
});

test("fails closed when no complete deployable layout exists", async (t) => {
  const { root, source } = await fixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  await put(source, ".next/server/app.js", "incomplete");
  await assert.rejects(detectPackageMode(source), /no deployable Next\.js layout/);
});
