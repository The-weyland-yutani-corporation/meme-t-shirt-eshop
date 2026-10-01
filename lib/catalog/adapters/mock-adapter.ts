/**
 * In-memory mock implementation of `PrintProviderAdapter`.
 *
 * Faithful to the shape and error behavior the real Printful adapter
 * must exhibit, so downstream catalog/checkout code can be built and
 * tested without live Printful calls or credentials (R5, R9).
 */

import type { Product, ProductVariant } from "../types.ts";
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
  /** Seed catalog data. Defaults to a small built-in sample catalog. */
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
  return [
    {
      id: "classic-meme-tee",
      name: "Classic Meme Tee",
      description: "A soft-cotton unisex tee with a classic meme print.",
      categoryId: "t-shirts",
      tagIds: ["bestseller"],
      images: ["/images/classic-meme-tee-front.png"],
      variants: [
        {
          id: "classic-meme-tee-s-black",
          productId: "classic-meme-tee",
          name: "Black / S",
          size: "S",
          color: "Black",
          priceCents: 2499,
          currency: "USD",
          providerVariantId: "pf-1001",
          isAvailable: true,
        },
        {
          id: "classic-meme-tee-m-black",
          productId: "classic-meme-tee",
          name: "Black / M",
          size: "M",
          color: "Black",
          priceCents: 2499,
          currency: "USD",
          providerVariantId: "pf-1002",
          isAvailable: true,
        },
      ],
    },
    {
      id: "limited-drop-hoodie",
      name: "Limited Drop Hoodie",
      description: "Heavyweight hoodie from a limited seasonal drop.",
      categoryId: "hoodies",
      tagIds: ["limited-edition"],
      images: ["/images/limited-drop-hoodie-front.png"],
      variants: [
        {
          id: "limited-drop-hoodie-l-grey",
          productId: "limited-drop-hoodie",
          name: "Grey / L",
          size: "L",
          color: "Grey",
          priceCents: 5499,
          currency: "USD",
          providerVariantId: "pf-2001",
          isAvailable: false,
        },
      ],
    },
  ];
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
    return this.products.map((product) => ({ ...product }));
  }

  async getProduct(productId: string): Promise<Product> {
    const product = this.products.find((p) => p.id === productId);
    if (!product) {
      throw new ProviderNotFoundError(`Product not found: ${productId}`);
    }
    return { ...product };
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
      if (item.quantity <= 0) {
        throw new ProviderOrderError(
          `Invalid quantity for variant ${item.variantId}: ${item.quantity}`,
        );
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
