/**
 * Shared site-wide configuration for SEO/structured-data concerns
 * (canonical URLs, metadata base, site name).
 *
 * `NEXT_PUBLIC_SITE_URL` should be set in production deployments so
 * sitemap/robots/structured-data/canonical URLs are correct. Falls back to
 * a clearly-fake placeholder domain in its absence so local/dev/test runs
 * never silently emit production-looking URLs.
 */

export const siteName = "Meme T-Shirt Eshop";

export const siteUrl: string =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://example-redacted.invalid";

/** Joins the site's base URL with a path, avoiding duplicate slashes. */
export function absoluteUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${siteUrl}${normalizedPath}`;
}
