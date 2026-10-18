import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { MockPrintProviderAdapter } from "../mock-adapter.ts";

test("local mock product images resolve to public assets", async () => {
  const products = await new MockPrintProviderAdapter().listProducts();
  const localImagePaths = products.flatMap((product) =>
    product.images.filter((imagePath) => imagePath.startsWith("/")),
  );

  assert.ok(localImagePaths.length > 0, "expected local mock product images");

  for (const imagePath of localImagePaths) {
    const publicAssetPath = path.join(
      process.cwd(),
      "public",
      ...imagePath.split("/").filter(Boolean),
    );

    assert.ok(
      existsSync(publicAssetPath),
      `missing public asset for mock product image ${imagePath}`,
    );
  }
});
