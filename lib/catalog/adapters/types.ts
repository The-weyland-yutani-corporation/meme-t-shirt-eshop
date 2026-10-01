/**
 * Printful (print-on-demand fulfillment) adapter contract.
 *
 * This interface isolates catalog/checkout code from any specific
 * fulfillment provider's API. A faithful in-memory mock
 * (`MockPrintProviderAdapter`) implements this same contract so
 * downstream development (catalog browsing, cart, checkout) can
 * proceed without live Printful calls or credentials. A future
 * `PrintfulAdapter` implementing this interface can be swapped in
 * without changing any calling code.
 */

import type { Product, ProductVariant } from "../types.ts";

/** A provider-side order line item, referencing a catalog variant. */
export interface OrderLineItem {
  /** Catalog variant being ordered. */
  variantId: string;
  /** Quantity of this variant. */
  quantity: number;
}

/** Shipping destination required to place a fulfillment order. */
export interface ShippingAddress {
  name: string;
  address1: string;
  address2?: string;
  city: string;
  stateCode?: string;
  countryCode: string;
  zip: string;
}

/** Result of successfully submitting an order to the provider. */
export interface ProviderOrderResult {
  /** Provider-assigned order identifier. */
  providerOrderId: string;
  /** Current provider-side status of the order. */
  status: "pending" | "fulfilled" | "failed";
}

/** Raised when a requested product or variant does not exist upstream. */
export class ProviderNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderNotFoundError";
  }
}

/** Raised when the provider rejects an order submission. */
export class ProviderOrderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderOrderError";
  }
}

/**
 * Contract implemented by any print-on-demand fulfillment integration
 * (e.g. Printful) as well as by the in-memory mock used for
 * pre-integration development and tests.
 */
export interface PrintProviderAdapter {
  /** List all products currently available from the provider's catalog. */
  listProducts(): Promise<Product[]>;

  /** Fetch a single product by catalog id, or throw ProviderNotFoundError. */
  getProduct(productId: string): Promise<Product>;

  /** Fetch a single variant by catalog id, or throw ProviderNotFoundError. */
  getVariant(variantId: string): Promise<ProductVariant>;

  /** Check real-time availability for a variant. */
  checkAvailability(variantId: string): Promise<boolean>;

  /**
   * Submit an order for fulfillment.
   * Throws ProviderNotFoundError if any line item references an unknown
   * variant, or ProviderOrderError if the provider rejects the order.
   */
  createOrder(
    items: OrderLineItem[],
    shippingAddress: ShippingAddress,
  ): Promise<ProviderOrderResult>;
}
