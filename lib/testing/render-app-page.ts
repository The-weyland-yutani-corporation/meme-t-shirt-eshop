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
import { pathToFileURL } from "node:url";

let extensionsInstalled = false;

/** CSS has no meaning outside a bundler; stub it to an empty module. */
function ensureCssStub(): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Module as any)._extensions[".css"] = (mod: NodeModule) => {
    mod.exports = {};
  };
}

/**
 * Transpiles a `.ts`/`.tsx` source file to CommonJS via the TypeScript
 * compiler API and `_compile`s it into the given module.
 */
function transpileAndCompile(mod: NodeModule, filename: string): void {
  const source = fs.readFileSync(filename, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: filename,
    transformers: {
      before: [(context) => {
        const visit: ts.Visitor = (node) => {
          if (ts.isMetaProperty(node) && node.keywordToken === ts.SyntaxKind.ImportKeyword) {
            return ts.factory.createObjectLiteralExpression([
              ts.factory.createPropertyAssignment("url", ts.factory.createStringLiteral(pathToFileURL(filename).href)),
            ]);
          }
          return ts.visitEachChild(node, visit, context);
        };
        return (sourceFile) => ts.visitNode(sourceFile, visit) as ts.SourceFile;
      }],
    },
  });

  (mod as unknown as {
    _compile(code: string, filename: string): void;
  })._compile(outputText, filename);
}

/**
 * Registers CommonJS extension handlers for `.ts`/`.tsx` so that, once the
 * entry file is loaded via {@link loadAppModule}, any nested local
 * `require`/import of other `.ts`/`.tsx` files (e.g. a page importing a
 * shared lib module) is transpiled the same way instead of falling through
 * to Node's default loader (which doesn't understand `.tsx` or strip
 * types from re-exported `.ts` files it `require`s transitively).
 */
function ensureTsExtensionsInstalled(): void {
  if (extensionsInstalled) return;
  ensureCssStub();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Module as any)._extensions[".ts"] = transpileAndCompile;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Module as any)._extensions[".tsx"] = transpileAndCompile;
  extensionsInstalled = true;
}

/**
 * Transpiles and loads a `.tsx`/`.ts` file as CommonJS, returning its
 * module exports (including `default` and any named exports such as
 * `metadata`).
 */
export function loadAppModule<T = Record<string, unknown>>(
  absolutePath: string
): T {
  ensureTsExtensionsInstalled();

  const moduleInstance = new Module(absolutePath);
  moduleInstance.filename = absolutePath;
  moduleInstance.paths = (Module as unknown as {
    _nodeModulePaths(path: string): string[];
  })._nodeModulePaths(process.cwd());
  transpileAndCompile(moduleInstance, absolutePath);

  return moduleInstance.exports as T;
}
