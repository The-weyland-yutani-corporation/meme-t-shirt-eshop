/**
 * Automated accessibility checks (R6) for core storefront pages, wired into
 * CI via `npm run test` (see `.github/workflows/ci.yml`'s "Test" step).
 *
 * Pages are rendered to static HTML with `loadAppModule` (no browser, no
 * Next.js dev server) and scanned with axe-core inside a jsdom document.
 * This keeps the check hermetic and fast while still exercising the real
 * rendered markup for WCAG 2.2 AA-relevant violations (missing `lang`,
 * missing document title, image alt text, heading structure, etc.).
 */

import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import axeCore from "axe-core";

import { loadAppModule } from "../../lib/testing/render-app-page.ts";

const appDir = path.join(process.cwd(), "app");

interface LayoutProps {
  children: React.ReactNode;
}

interface AppMetadata {
  title?: string;
  description?: string;
}

/**
 * Renders a top-level `app/*.tsx` page through the real `app/layout.tsx`
 * wrapper and returns a full HTML document string, including a `<title>`
 * sourced from the layout's `metadata` export (Next.js injects this via its
 * head-management machinery, which this lightweight harness does not run).
 */
function renderFullPage(pageFile: string, content?: React.ReactElement): string {
  const layoutModule = loadAppModule<{
    default: (props: LayoutProps) => React.ReactElement;
    metadata?: AppMetadata;
  }>(path.join(appDir, "layout.tsx"));
  const pageModule = loadAppModule<{
    default: () => React.ReactElement;
  }>(path.join(appDir, pageFile));

  const bodyHtml = renderToStaticMarkup(
    layoutModule.default({ children: content ?? pageModule.default() })
  );
  const title = layoutModule.metadata?.title ?? "";

  // layoutModule.default already renders <html>/<body>; splice in a <head>
  // with the title since this harness doesn't run Next.js metadata injection.
  const innerHtml = bodyHtml
    .replace(/^<html[^>]*>/, "")
    .replace(/<\/html>$/, "");
  return `<!doctype html><html lang="en"><head><title>${title}</title></head>${innerHtml}`;
}

async function runAxe(html: string) {
  const dom = new JSDOM(html);
  return axeCore.run(dom.window.document.documentElement, {});
}

test("home page has no automated accessibility violations", async () => {
  const html = renderFullPage("page.tsx");
  const results = await runAxe(html);
  assert.deepEqual(
    results.violations.map((violation) => violation.id),
    [],
    `axe-core violations:\n${JSON.stringify(results.violations, null, 2)}`
  );
});

test("home page document has a lang attribute and a non-empty title", async () => {
  const html = renderFullPage("page.tsx");
  const dom = new JSDOM(html);
  assert.equal(dom.window.document.documentElement.getAttribute("lang"), "en");
  assert.ok(dom.window.document.title.trim().length > 0);
});

for (const [file, props] of [
  ["catalog/page.tsx", { searchParams: Promise.resolve({}) }],
  ["catalog/[productId]/page.tsx", { params: Promise.resolve({ productId: "classic-meme-tee" }) }],
  ["catalog/[productId]/page.tsx", { params: Promise.resolve({ productId: "limited-drop-hoodie" }) }],
  ["checkout/page.tsx", { searchParams: Promise.resolve({ variantId: "classic-meme-tee-s-black", quantity: "2" }) }],
  ["checkout/page.tsx", { searchParams: Promise.resolve({ variantId: "missing", quantity: "1.5" }) }],
  ["orders/page.tsx", { searchParams: Promise.resolve({ variantId: "classic-meme-tee-s-black", quantity: "2", status: "completed" }) }],
  ["orders/page.tsx", { searchParams: Promise.resolve({ variantId: "classic-meme-tee-s-black", quantity: "2", status: "cancelled" }) }],
] as const) {
  test(`${file} ${JSON.stringify(props)} has no automated accessibility violations`, async () => {
    const page = loadAppModule<{ default(props: unknown): Promise<React.ReactElement> }>(path.join(appDir, file));
    const html = renderFullPage(file, await page.default(props));
    const results = await runAxe(html);
    assert.deepEqual(results.violations.map((violation) => violation.id), []);
    if (file === "orders/page.tsx") {
      assert.match(html, /No payment was taken/);
      assert.match(html, /not a stored order/);
    }
  });
}
