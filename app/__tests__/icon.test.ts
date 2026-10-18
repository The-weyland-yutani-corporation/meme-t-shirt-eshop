import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

test("the App Router favicon metadata asset is an accessible SVG", async () => {
  const iconPath = path.join(process.cwd(), "app", "icon.svg");
  const icon = await readFile(iconPath, "utf8");

  assert.match(icon, /^<svg\b/);
  assert.match(icon, /<title\b[^>]*>[^<]+<\/title>/);
  assert.match(icon, /\bviewBox="0 0 64 64"/);
});
