/**
 * Real Printful implementation of `PrintProviderAdapter`.
 *
 * Talks to the Printful v1 REST API for catalog reads, order
 * submission, and fulfillment status polling, behind the same
 * contract exercised by `MockPrintProviderAdapter` (see
 * `__tests__/provider-adapter.contract.test.ts`). Network calls are
 * made through an injectable `fetch` implementation so this adapter
 * can be contract-tested without live Printful calls or credentials.
 *
 * Retries are bounded: only transient failures (network errors, 429,
 * and 5xx responses) are retried, up to `maxRetries` times with
 * exponential backoff, so a persistently failing provider surfaces a
 * customer-safe error instead of retrying forever.
 */

import type { Product, ProductVariant } from "../types.ts";
import { ProviderNotFoundError, ProviderOrderError } from "./types.ts";
import type {
  OrderLineItem,
  PrintProviderAdapter,
  ProviderOrderResult,
  ShippingAddress,
} from "./types.ts";

/** Minimal fetch-compatible signature, for dependency injection in tests. */
export type FetchLike = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  },
) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

export interface PrintfulAdapterOptions {
  /** Printful API key (Bearer token). Required for all live calls. */
  apiKey: string;
  /** Optional Printful store id, sent as `X-PF-Store-Id` when set. */
  storeId?: string;
  /** API base URL. Defaults to the production Printful v1 API. */
  baseUrl?: string;
  /** Injectable fetch implementation, primarily for tests. */
  fetchImpl?: FetchLike;
  /** Maximum number of retry attempts for transient failures. Default 3. */
  maxRetries?: number;
  /** Base delay in ms for exponential backoff between retries. Default 200. */
  retryDelayMsBase?: number;
}

/** Raw shape of a Printful sync variant, as relevant to this adapter. */
interface PrintfulSyncVariant {
  id: number;
  variant_id: number;
  name: string;
  retail_price: string;
  currency: string;
  size?: string;
  color?: string;
  availability_status?: string;
}

/** Raw shape of a Printful sync product, as relevant to this adapter. */
interface PrintfulSyncProduct {
  id: number;
  name: string;
  thumbnail_url?: string;
  sync_variants?: PrintfulSyncVariant[];
}

/** Raw shape of a Printful order, as relevant to this adapter. */
interface PrintfulOrder {
  id: number;
  status: string;
}

const TRANSIENT_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);

/** Maps a Printful order status to the adapter contract's status union. */
function mapOrderStatus(printfulStatus: string): "pending" | "fulfilled" | "failed" {
  switch (printfulStatus) {
    case "fulfilled":
      return "fulfilled";
    case "failed":
    case "canceled":
      return "failed";
    default:
      // draft, pending, inprocess, onhold, partial, archived, etc.
      return "pending";
  }
}

export class PrintfulAdapter implements PrintProviderAdapter {
  private readonly apiKey: string;
  private readonly storeId?: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;
  private readonly maxRetries: number;
  private readonly retryDelayMsBase: number;

  constructor(options: PrintfulAdapterOptions) {
    if (!options.apiKey) {
      throw new Error("PrintfulAdapter requires an apiKey");
    }
    this.apiKey = options.apiKey;
    this.storeId = options.storeId;
    this.baseUrl = options.baseUrl ?? "https://api.printful.com";
    this.fetchImpl = options.fetchImpl ?? (fetch as unknown as FetchLike);
    this.maxRetries = options.maxRetries ?? 3;
    this.retryDelayMsBase = options.retryDelayMsBase ?? 200;
  }

  async listProducts(): Promise<Product[]> {
    const body = await this.request<{ result: PrintfulSyncProduct[] }>(
      "GET",
      "/store/products",
    );
    const products: Product[] = [];
    for (const syncProduct of body.result) {
      products.push(await this.getProduct(String(syncProduct.id)));
    }
    return products;
  }

  async getProduct(productId: string): Promise<Product> {
    const body = await this.request<{
      result: { sync_product: PrintfulSyncProduct; sync_variants: PrintfulSyncVariant[] };
    }>("GET", `/store/products/${encodeURIComponent(productId)}`, {
      notFoundMessage: `Product not found: ${productId}`,
    });

    const { sync_product: syncProduct, sync_variants: syncVariants } = body.result;
    return this.toProduct(syncProduct, syncVariants);
  }

  async getVariant(variantId: string): Promise<ProductVariant> {
    const body = await this.request<{
      result: { sync_variant: PrintfulSyncVariant };
    }>("GET", `/store/variants/${encodeURIComponent(variantId)}`, {
      notFoundMessage: `Variant not found: ${variantId}`,
    });
    return this.toVariant(body.result.sync_variant, "");
  }

  async checkAvailability(variantId: string): Promise<boolean> {
    const variant = await this.getVariant(variantId);
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
      if (item.quantity <= 0) {
        throw new ProviderOrderError(
          `Invalid quantity for variant ${item.variantId}: ${item.quantity}`,
        );
      }
    }
    if (!shippingAddress.countryCode || !shippingAddress.zip) {
      throw new ProviderOrderError("Shipping address is incomplete");
    }

    const payload = {
      recipient: {
        name: shippingAddress.name,
        address1: shippingAddress.address1,
        address2: shippingAddress.address2,
        city: shippingAddress.city,
        state_code: shippingAddress.stateCode,
        country_code: shippingAddress.countryCode,
        zip: shippingAddress.zip,
      },
      items: items.map((item) => ({
        sync_variant_id: item.variantId,
        quantity: item.quantity,
      })),
    };

    let body: { result: PrintfulOrder };
    try {
      body = await this.request<{ result: PrintfulOrder }>(
        "POST",
        "/orders",
        { body: payload, notFoundMessage: undefined },
      );
    } catch (error) {
      if (error instanceof ProviderNotFoundError) {
        throw new ProviderNotFoundError(
          `One or more variants were not found: ${items.map((i) => i.variantId).join(", ")}`,
        );
      }
      if (error instanceof ProviderOrderError) {
        throw error;
      }
      throw new ProviderOrderError(
        `Printful order submission failed: ${(error as Error).message}`,
      );
    }

    return {
      providerOrderId: String(body.result.id),
      status: mapOrderStatus(body.result.status),
    };
  }

  /**
   * Polls Printful for the current status of a previously submitted
   * order. Not part of `PrintProviderAdapter`; callers that need
   * fulfillment status updates (directly, or to reconcile a webhook
   * event) use this alongside `createOrder`.
   */
  async getOrderStatus(providerOrderId: string): Promise<ProviderOrderResult> {
    const body = await this.request<{ result: PrintfulOrder }>(
      "GET",
      `/orders/${encodeURIComponent(providerOrderId)}`,
      { notFoundMessage: `Order not found: ${providerOrderId}` },
    );
    return {
      providerOrderId: String(body.result.id),
      status: mapOrderStatus(body.result.status),
    };
  }

  private toProduct(
    syncProduct: PrintfulSyncProduct,
    syncVariants: PrintfulSyncVariant[],
  ): Product {
    return {
      id: String(syncProduct.id),
      name: syncProduct.name,
      description: syncProduct.name,
      categoryId: "uncategorized",
      tagIds: [],
      images: syncProduct.thumbnail_url ? [syncProduct.thumbnail_url] : [],
      variants: syncVariants.map((v) => this.toVariant(v, String(syncProduct.id))),
    };
  }

  private toVariant(syncVariant: PrintfulSyncVariant, productId: string): ProductVariant {
    const priceCents = Math.round(parseFloat(syncVariant.retail_price) * 100);
    return {
      id: String(syncVariant.id),
      productId,
      name: syncVariant.name,
      size: syncVariant.size,
      color: syncVariant.color,
      priceCents: Number.isFinite(priceCents) ? priceCents : 0,
      currency: syncVariant.currency || "USD",
      providerVariantId: String(syncVariant.variant_id ?? syncVariant.id),
      isAvailable:
        syncVariant.availability_status === undefined ||
        syncVariant.availability_status === "active",
    };
  }

  /** Issues an HTTP request with bounded retries for transient failures. */
  private async request<T>(
    method: "GET" | "POST",
    path: string,
    options: { body?: unknown; notFoundMessage?: string } = {},
  ): Promise<T> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
    };
    if (this.storeId) {
      headers["X-PF-Store-Id"] = this.storeId;
    }

    let attempt = 0;
    let lastError: unknown;

    while (attempt <= this.maxRetries) {
      try {
        const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
          method,
          headers,
          body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        });

        if (response.status === 404) {
          throw new ProviderNotFoundError(
            options.notFoundMessage ?? `Resource not found: ${path}`,
          );
        }

        if (!response.ok) {
          if (TRANSIENT_STATUS_CODES.has(response.status) && attempt < this.maxRetries) {
            attempt += 1;
            await this.delay(attempt);
            continue;
          }
          throw new ProviderOrderError(
            `Printful API request failed with status ${response.status}`,
          );
        }

        return (await response.json()) as T;
      } catch (error) {
        if (error instanceof ProviderNotFoundError || error instanceof ProviderOrderError) {
          throw error;
        }
        // Network-level failure: treat as transient and retry if budget remains.
        lastError = error;
        if (attempt < this.maxRetries) {
          attempt += 1;
          await this.delay(attempt);
          continue;
        }
        throw new ProviderOrderError(
          `Printful API request failed after ${this.maxRetries} retries: ${
            (error as Error).message
          }`,
        );
      }
    }

    throw new ProviderOrderError(
      `Printful API request failed after ${this.maxRetries} retries: ${
        (lastError as Error | undefined)?.message ?? "unknown error"
      }`,
    );
  }

  private delay(attempt: number): Promise<void> {
    const ms = this.retryDelayMsBase * 2 ** (attempt - 1);
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/** Printful webhook event payload, as relevant to order status sync. */
export interface PrintfulWebhookEvent {
  type: string;
  data: {
    order: PrintfulOrder;
  };
}

/**
 * Maps a Printful webhook payload to the same customer-safe
 * `ProviderOrderResult` shape produced by `createOrder` /
 * `getOrderStatus`, so the storefront can treat webhook-driven and
 * polled status updates identically. Returns `undefined` for event
 * types that are not order status updates.
 */
export function mapWebhookEventToOrderResult(
  event: PrintfulWebhookEvent,
): ProviderOrderResult | undefined {
  if (!event?.data?.order) {
    return undefined;
  }
  return {
    providerOrderId: String(event.data.order.id),
    status: mapOrderStatus(event.data.order.status),
  };
}
