# Catalog/content operator workflow

Operators update the storefront catalog/content (categories, tags,
products, and variants) by editing
[`lib/catalog/content/catalog.config.json`](./catalog.config.json) and
submitting the change through a normal pull request review — the same
review process as any other code change. There is no admin UI, no
database, and no privileged infrastructure, identity, or RBAC access
involved: the only thing an operator touches is version-controlled
content data.

## Making a change

1. Edit `catalog.config.json` directly (add/update/remove categories,
   tags, products, or variants).
2. Open a pull request. CI runs `npm run typecheck`, `npm run lint`,
   and `npm test`, which includes `loadCatalogConfig()` validating the
   file against the catalog domain model in
   [`../types.ts`](../types.ts).
3. Once reviewed and merged, the updated config is loaded by
   `loadCatalogConfig()` wherever the storefront needs catalog data.

## Validation rules

`validateCatalogConfig` (see [`catalog-config.ts`](./catalog-config.ts))
enforces:

- Required fields and types for every category, tag, product, and
  variant, matching the shapes in `../types.ts`.
- No duplicate category, tag, or product ids.
- Every category `parentId` refers to an existing category.
- Every product `categoryId` refers to an existing category.
- Every product `tagIds` entry refers to an existing tag.
- Every product has at least one variant, and each variant's
  `productId` matches its parent product.
- Variant `priceCents` is a non-negative integer.

Malformed content fails fast with a `CatalogConfigError` describing the
first problem found, instead of silently reaching the storefront or
checkout flow.
