export type {
  Category,
  Tag,
  SizeUnit,
  Product,
  ProductVariant,
} from "./types.ts";

export type {
  PrintProviderAdapter,
  OrderLineItem,
  ShippingAddress,
  ProviderOrderResult,
} from "./adapters/types.ts";

export {
  ProviderNotFoundError,
  ProviderOrderError,
} from "./adapters/types.ts";

export { MockPrintProviderAdapter } from "./adapters/mock-adapter.ts";
export type { MockPrintProviderAdapterOptions } from "./adapters/mock-adapter.ts";

export { PrintfulAdapter, mapWebhookEventToOrderResult } from "./adapters/printful-adapter.ts";
export type {
  PrintfulAdapterOptions,
  PrintfulWebhookEvent,
  FetchLike,
} from "./adapters/printful-adapter.ts";
