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

export {
  CatalogConfigError,
  loadCatalogConfig,
  validateCatalogConfig,
} from "./content/catalog-config.ts";
export type { CatalogConfig } from "./content/catalog-config.ts";
