# bitsnap-payloadcms

Bitsnap plugin for [Payload CMS 3](https://payloadcms.com) — product sync, an admin product
manager, searchable product picker, and row label component for Payload-based storefronts.

The plugin adds:

- **Bitsnap fields** (`bitsnapID`, `skipSync`, `docUrl`) to the collections you list in `sync`.
- **Zero-config admin components** — a product manager (`BitsnapManager`), a "show in Bitsnap" link
  (`LinkToDoc`), a searchable/paginated product picker (`ProductSelect`), and a row label
  (`BitsnapProductRowLabel`).
- **REST endpoints** powered by per-instance `bitsnap-js/client` (`bitsnap-js@^1.8.1`), secured by
  admin user access control by default.

## Installation

```bash
pnpm add bitsnap-payloadcms
# or
npm install bitsnap-payloadcms
```

### 1. Register the plugin

```ts
// src/payload.config.ts
import { bitsnapPlugin } from 'bitsnap-payloadcms'
import { buildConfig } from 'payload'

export default buildConfig({
  // ...
  plugins: [
    bitsnapPlugin({
      bitsnapApiKey: process.env.BITSNAP_API_KEY ?? '',
      host: process.env.CUSTOM_BITSNAP_HOST, // optional, defaults to https://bitsnap.pl
      currency: 'PLN',
      sync: [{ collection: 'products', fields: [] }],
    }),
  ],
})
```

The plugin stores its public client config (`apiBaseUrl`, `currency`, `host`, `projectId`) in
`config.admin.custom.bitsnap` so field helpers require zero configuration arguments. The API key
stays strictly server-side in `config.custom.bitsnap`.

### 2. Regenerate the Payload artefacts — mandatory

```bash
pnpm generate:importmap   # required — resolves the admin components
pnpm generate:types       # required — refreshes the generated types
```

## Configuration

| Option          | Type            | Default                                  | Description                                                                        |
| --------------- | --------------- | ---------------------------------------- | ---------------------------------------------------------------------------------- |
| `bitsnapApiKey` | `string`        | —                                        | Bitsnap API key (`bs_test_...` / `bs_live_...`). Server-side only.                 |
| `host`          | `string`        | `CUSTOM_BITSNAP_HOST` / `https://bitsnap.pl` | Single source of truth for Bitsnap API and dashboard links.                    |
| `dashboardUrl`  | `string`        | —                                        | **Deprecated** alias for `host` (used only when `host` is omitted).                |
| `projectId`     | `string`        | auto-detected via `GetAccount`           | Optional fallback project ID (`BITSNAP_PROJECT_ID`).                               |
| `apiBasePath`   | `string`        | `/bitsnap`                               | Path the REST endpoints are mounted on, relative to Payload's API root.            |
| `currency`      | `string`        | `PLN`                                    | Default currency used when creating products and variants.                         |
| `access`        | `BitsnapAccess` | `defaultBitsnapAccess`                   | Custom endpoint access control. Default requires an authenticated admin user.      |
| `sync`          | `SyncConfig[]`  | `[]`                                     | Collections that receive `bitsnapID`, `skipSync`, and `docUrl`.                    |

## Zero-config field helpers

### `bitsnapManagerField(options?)`

```ts
import { bitsnapManagerField } from 'bitsnap-payloadcms'

export const Products: CollectionConfig = {
  slug: 'products',
  fields: [
    { name: 'title', type: 'text' },
    bitsnapManagerField(),
  ],
}
```

Options: `{ productIdPath?: string; overrides?: Partial<UIField> }` (`productIdPath` defaults to
`'bitsnapID'`). `overrides.admin`, `overrides.admin.components`, and `overrides.admin.custom` are
deep-merged so overriding admin properties never clobbers the Bitsnap UI component.

### `productSelectField(options?)`

```ts
import { productSelectField } from 'bitsnap-payloadcms'

export const ProductDetails: Block = {
  slug: 'productDetails',
  fields: [productSelectField()],
}
```

Options: `{ allowDrafts?: boolean; overrides?: Partial<TextField> }` (`allowDrafts` defaults to
`false`).

### `BITSNAP_PRODUCT_ROW_LABEL_COMPONENT_PATH`

Use `BITSNAP_PRODUCT_ROW_LABEL_COMPONENT_PATH` in array/block `admin.components.RowLabel` to display
a product's thumbnail, name, formatted price, and status pill:

```ts
import { BITSNAP_PRODUCT_ROW_LABEL_COMPONENT_PATH, productSelectField } from 'bitsnap-payloadcms'

export const ProductGrid: Block = {
  slug: 'productGrid',
  fields: [
    {
      name: 'products',
      type: 'array',
      admin: {
        components: {
          RowLabel: BITSNAP_PRODUCT_ROW_LABEL_COMPONENT_PATH,
        },
      },
      fields: [productSelectField()],
    },
  ],
}
```

## REST endpoints

All endpoints require an authenticated Payload admin user by default (`401` if unauthenticated,
`403` if `req.user.collection !== req.payload.config.admin.user`).

| Method  | Path                         | Description                                                                 |
| ------- | ---------------------------- | --------------------------------------------------------------------------- |
| `GET`   | `/api/bitsnap/account`       | Returns `{ projectId, projectName, environment, canWrite, scopes }`.        |
| `POST`  | `/api/bitsnap/products`      | Creates a product (`name`, `priceAmount`, `priceCurrency`, `status`, `availableQuantity`, `images`, `variants`). |
| `GET`   | `/api/bitsnap/products/:id`  | Reads a managed product (including `revision` and `images`).                |
| `PATCH` | `/api/bitsnap/products/:id`  | Patches a product with optimistic concurrency (`revision`).                 |
| `GET`   | `/api/bitsnap/shop-products` | Paginated/searchable list (`?search=&cursor=&limit=50&includeDrafts=false`).|

## Server client

```ts
import { createBitsnapServerClient } from 'bitsnap-payloadcms'

const client = createBitsnapServerClient({
  apiKey: process.env.BITSNAP_API_KEY!,
  host: process.env.CUSTOM_BITSNAP_HOST,
})

const account = await client.getAccount()
const { products, nextCursor } = await client.listProducts({ search: 'krem', limit: 20 })
const product = await client.getProduct(products[0].id)
```

## Publishing

Releases are published to npm by GitHub Actions with
[npm trusted publishing](https://docs.npmjs.com/trusted-publishers): the workflow
mints a short-lived OIDC token that npm exchanges for a publish token bound to
this repository. No npm token is stored in GitHub, so there is nothing to rotate.

To publish:

1. Bump the version in `package.json` and commit.
2. Tag the commit and create the GitHub release — creating the release is what
   starts the publish. The `Publish` workflow can also be run manually, with an
   optional npm dist-tag.

The workflow runs `pnpm run typecheck`, `pnpm run build`, then
`npm publish --provenance --access public`.

## License

MIT © Piotr Michalik
