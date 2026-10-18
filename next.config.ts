import type { NextConfig } from "next";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://example-redacted.invalid";

const nextConfig: NextConfig = {
  // applicationinsights uses native/dynamic requires that should run as
  // plain Node.js modules rather than being bundled by webpack/turbopack.
  serverExternalPackages: ["applicationinsights"],
  env: {
    NEXT_PUBLIC_SITE_URL: siteUrl,
  },
};

export default nextConfig;
