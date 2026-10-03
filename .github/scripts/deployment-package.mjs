import { cp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

async function copyRequired(source, destination, description) {
  if (!(await exists(source))) {
    throw new Error(`${description} is missing: ${source}`);
  }
  await cp(source, destination, { recursive: true });
}

async function copyOptional(source, destination) {
  if (await exists(source)) {
    await cp(source, destination, { recursive: true });
  }
}

export async function detectPackageMode(sourceDirectory) {
  const standaloneDirectory = path.join(sourceDirectory, ".next", "standalone");
  const standaloneServer = path.join(standaloneDirectory, "server.js");
  const standalonePackage = path.join(standaloneDirectory, "package.json");

  if ((await exists(standaloneServer)) && (await exists(standalonePackage))) {
    return "standalone";
  }

  const buildId = path.join(sourceDirectory, ".next", "BUILD_ID");
  const nextRuntime = path.join(sourceDirectory, "node_modules", "next", "package.json");
  if ((await exists(buildId)) && (await exists(nextRuntime))) {
    return "next-start";
  }

  throw new Error(
    "no deployable Next.js layout found; expected .next/standalone or .next/BUILD_ID with node_modules/next",
  );
}

async function writeStandalonePackageJson(destinationDirectory) {
  const packagePath = path.join(destinationDirectory, "package.json");
  const packageJson = JSON.parse(await readFile(packagePath, "utf8"));
  packageJson.scripts = { ...packageJson.scripts, start: "node server.js" };
  await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
}

export async function createDeploymentLayout({
  sourceDirectory,
  destinationDirectory,
}) {
  const mode = await detectPackageMode(sourceDirectory);
  await rm(destinationDirectory, { recursive: true, force: true });
  await mkdir(destinationDirectory, { recursive: true });

  if (mode === "standalone") {
    await copyRequired(
      path.join(sourceDirectory, ".next", "standalone"),
      destinationDirectory,
      "standalone output",
    );
    await writeStandalonePackageJson(destinationDirectory);
    await mkdir(path.join(destinationDirectory, ".next"), { recursive: true });
    await copyRequired(
      path.join(sourceDirectory, ".next", "static"),
      path.join(destinationDirectory, ".next", "static"),
      "Next.js static assets",
    );
  } else {
    await copyRequired(
      path.join(sourceDirectory, "package.json"),
      path.join(destinationDirectory, "package.json"),
      "package.json",
    );
    await copyOptional(
      path.join(sourceDirectory, "package-lock.json"),
      path.join(destinationDirectory, "package-lock.json"),
    );
    await copyRequired(
      path.join(sourceDirectory, ".next"),
      path.join(destinationDirectory, ".next"),
      "Next.js build output",
    );
    await copyRequired(
      path.join(sourceDirectory, "node_modules"),
      path.join(destinationDirectory, "node_modules"),
      "production node_modules",
    );
    for (const configName of ["next.config.js", "next.config.mjs", "next.config.ts"]) {
      await copyOptional(
        path.join(sourceDirectory, configName),
        path.join(destinationDirectory, configName),
      );
    }
  }

  await copyOptional(
    path.join(sourceDirectory, "public"),
    path.join(destinationDirectory, "public"),
  );
  return mode;
}

function argument(name, args) {
  const index = args.indexOf(`--${name}`);
  if (index === -1 || index === args.length - 1) {
    throw new Error(`--${name} is required`);
  }
  return args[index + 1];
}

async function appendOutput(name, value) {
  if (!process.env.GITHUB_OUTPUT) return;
  await writeFile(process.env.GITHUB_OUTPUT, `${name}=${value}\n`, { flag: "a" });
}

async function main(args) {
  const command = args.shift();
  const sourceDirectory = path.resolve(argument("source", args));

  if (command === "detect") {
    const mode = await detectPackageMode(sourceDirectory);
    await appendOutput("mode", mode);
    console.log(`Detected ${mode} deployment package layout.`);
    return;
  }
  if (command === "create") {
    const destinationDirectory = path.resolve(argument("destination", args));
    const mode = await createDeploymentLayout({ sourceDirectory, destinationDirectory });
    console.log(`Created ${mode} deployment package layout.`);
    return;
  }
  throw new Error(`unknown deployment-package command: ${command ?? "(missing)"}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(`::error::${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
