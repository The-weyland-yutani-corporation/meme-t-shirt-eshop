/**
 * In-memory mock implementation of `PrintProviderAdapter`.
 *
 * Faithful to the shape and error behavior the real Printful adapter
 * must exhibit, so downstream catalog/checkout code can be built and
 * tested without live Printful calls or credentials (R5, R9).
 */

import type { Product, ProductVariant } from "../types.ts";
import catalogContent from "../content/catalog.config.json" with { type: "json" };
import { validateCatalogConfig } from "../content/catalog-config.ts";
import {
  ProviderNotFoundError,
  ProviderOrderError,
} from "./types.ts";
import type {
  OrderLineItem,
  PrintProviderAdapter,
  ProviderOrderResult,
  ShippingAddress,
} from "./types.ts";

export interface MockPrintProviderAdapterOptions {
  /** Seed catalog data. Defaults to the validated, version-controlled catalog. */
  products?: Product[];
  /**
   * Variant ids that should be treated as unavailable/out of stock,
   * regardless of their `isAvailable` flag. Useful for exercising
   * availability edge cases in tests.
   */
  unavailableVariantIds?: string[];
  /**
   * When true, every `createOrder` call fails with ProviderOrderError.
   * Useful for exercising checkout error handling.
   */
  simulateOrderFailures?: boolean;
}

function defaultProducts(): Product[] {
  return validateCatalogConfig(catalogContent).products;
}

export class MockPrintProviderAdapter implements PrintProviderAdapter {
  private readonly products: Product[];
  private readonly unavailableVariantIds: Set<string>;
  private readonly simulateOrderFailures: boolean;

  constructor(options: MockPrintProviderAdapterOptions = {}) {
    this.products = options.products ?? defaultProducts();
    this.unavailableVariantIds = new Set(options.unavailableVariantIds ?? []);
    this.simulateOrderFailures = options.simulateOrderFailures ?? false;
  }

  async listProducts(): Promise<Product[]> {
    return structuredClone(this.products);
  }

  async getProduct(productId: string): Promise<Product> {
    const product = this.products.find((p) => p.id === productId);
    if (!product) {
      throw new ProviderNotFoundError(`Product not found: ${productId}`);
    }
    return structuredClone(product);
  }

  async getVariant(variantId: string): Promise<ProductVariant> {
    const variant = this.findVariant(variantId);
    if (!variant) {
      throw new ProviderNotFoundError(`Variant not found: ${variantId}`);
    }
    return { ...variant };
  }

  async checkAvailability(variantId: string): Promise<boolean> {
    const variant = this.findVariant(variantId);
    if (!variant) {
      throw new ProviderNotFoundError(`Variant not found: ${variantId}`);
    }
    if (this.unavailableVariantIds.has(variantId)) {
      return false;
    }
    return variant.isAvailable;
  }

  async createOrder(
    items: OrderLineItem[],
    shippingAddress: ShippingAddress,
  ): Promise<ProviderOrderResult> {
    if (items.length === 0) {
      throw new ProviderOrderError("Cannot create an order with no line items");
    }

    for (const item of items) {
      if (!this.findVariant(item.variantId)) {
        throw new ProviderNotFoundError(`Variant not found: ${item.variantId}`);
      }
      if (!Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 10) {
        throw new ProviderOrderError(
          `Invalid quantity for variant ${item.variantId}: ${item.quantity}`,
        );
      }
      if (!(await this.checkAvailability(item.variantId))) {
        throw new ProviderOrderError(`Variant unavailable: ${item.variantId}`);
      }
    }

    if (!shippingAddress.countryCode || !shippingAddress.zip) {
      throw new ProviderOrderError("Shipping address is incomplete");
    }

    if (this.simulateOrderFailures) {
      throw new ProviderOrderError("Simulated provider order failure");
    }

    return {
      providerOrderId: `mock-order-${Math.random().toString(36).slice(2, 10)}`,
      status: "pending",
    };
  }

  private findVariant(variantId: string): ProductVariant | undefined {
    for (const product of this.products) {
      const variant = product.variants.find((v) => v.id === variantId);
      if (variant) {
        return variant;
      }
    }
    return undefined;
  }
}
