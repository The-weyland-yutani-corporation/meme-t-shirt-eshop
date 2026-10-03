/**
 * Minimal test-only helper for rendering `app/*.tsx` Server Components to
 * static HTML outside of the Next.js build pipeline, so accessibility
 * checks (R6) can run under Node's built-in test runner without a browser
 * or a full Next.js dev/build server.
 *
 * Next.js app-router files use `.tsx` syntax that Node's
 * `--experimental-strip-types` flag cannot transform (it strips types only,
 * it does not compile JSX). This helper uses the TypeScript compiler API to
 * transpile a single file to CommonJS + `react/jsx-runtime` calls, then
 * loads it through Node's CommonJS loader so relative imports (and CSS
 * imports, stubbed below) resolve the same way they would in the app.
 */

import fs from "node:fs";
import Module from "node:module";
import ts from "typescript";

let cssStubInstalled = false;

/** CSS has no meaning outside a bundler; stub it to an empty module. */
function ensureCssStub(): void {
  if (cssStubInstalled) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Module as any)._extensions[".css"] = (mod: NodeModule) => {
    mod.exports = {};
  };
  cssStubInstalled = true;
}

/**
 * Transpiles and loads a `.tsx`/`.ts` file as CommonJS, returning its
 * module exports (including `default` and any named exports such as
 * `metadata`).
 */
export function loadAppModule<T = Record<string, unknown>>(
  absolutePath: string
): T {
  ensureCssStub();

  const source = fs.readFileSync(absolutePath, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: absolutePath,
  });

  const moduleInstance = new Module(absolutePath);
  moduleInstance.filename = absolutePath;
  moduleInstance.paths = (Module as unknown as {
    _nodeModulePaths(path: string): string[];
  })._nodeModulePaths(process.cwd());
  (moduleInstance as unknown as {
    _compile(code: string, filename: string): void;
  })._compile(outputText, absolutePath);

  return moduleInstance.exports as T;
}
