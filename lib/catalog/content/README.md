# Catalog/content operator workflow

Operators update the storefront's catalog/content (categories, tags,
products, and their print-on-demand variants) by editing this
directory's `catalog.config.json` file directly and opening a normal
pull request — no admin UI, database, or privileged infrastructure,
secrets, or identity/RBAC access is required or granted.

## Workflow

1. Edit `catalog.config.json` (add/update/remove a category, tag,
   product, or variant).
2. Open a pull request with the change.
3. CI runs the project's tests, which include
   `catalog-config.test.ts`. That suite calls `loadCatalogConfig()`,
   which validates the file the same way `validateCatalogConfig()`
   does: required fields/types, duplicate ids, cross-references
   (category `parentId`, product `categoryId`/`tagIds`, variant
   `productId`), non-empty variants, and variant `priceCents`
   integrity. Invalid content fails the build with a descriptive
   `CatalogConfigError` instead of reaching production.
4. A reviewer approves and merges the pull request like any other
   code change.

## Why a config file instead of an admin UI

This resolves the "admin UI vs. config file" decision from research in
favor of defaulting to config + PR review: it keeps the operator
surface area small, auditable via normal git history/PR review, and
free of any new credentials, database, or privileged infra/RBAC
surface. An admin UI can be layered on top later if the operational
volume justifies it, without changing this validated file format.

## API

- `loadCatalogConfig(path?)` — reads and validates
  `catalog.config.json` (or a given path), returning a
  `CatalogConfig` (`{ categories, tags, products }`) built from the
  domain types in `../types.ts`.
- `validateCatalogConfig(raw)` — validates an already-parsed JSON
  value without touching the filesystem; throws `CatalogConfigError`
  describing the first problem found.
