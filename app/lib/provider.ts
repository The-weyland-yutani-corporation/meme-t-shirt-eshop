/**
 * Shared fulfillment provider instance for storefront pages.
 *
 * Uses the in-memory `MockPrintProviderAdapter` per the catalog adapter
 * interface (see `lib/catalog`), so storefront pages can be built and
 * rendered without live Printful credentials. Swapping in a real
 * `PrintfulAdapter` later only requires changing this file.
 */
import { MockPrintProviderAdapter } from "@/lib/catalog";
import type { PrintProviderAdapter } from "@/lib/catalog";

let provider: PrintProviderAdapter | undefined;

export function getProvider(): PrintProviderAdapter {
  if (!provider) {
    provider = new MockPrintProviderAdapter();
  }
  return provider;
}
