# bitsnap-payloadcms

Bitsnap plugin for [Payload CMS 3](https://payloadcms.com) — product sync, an admin product
manager and a product picker for Payload-based storefronts.

The plugin adds:

- **Bitsnap fields** (`bitsnapID`, `skipSync`, `docUrl`) to the collections you list in `sync`.
- **Admin components** — a product manager (`BitsnapManager`), a "show in Bitsnap" link
  (`LinkToDoc`) and a product picker (`ProductSelect`) that all live in the Payload admin.
- **REST endpoints** that proxy the Bitsnap product API so the admin UI never needs the
  Bitsnap API key.

## Installation

```bash
pnpm add bitsnap-payloadcms
# or
npm install bitsnap-payloadcms
```

> **Not on npm yet?** Install the published tarball from the GitHub release:
>
> ```bash
> pnpm add https://github.com/emmems/bitsnap-payloadcms/releases/download/v0.1.1/bitsnap-payloadcms-0.1.1.tgz
> ```

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
      projectId: process.env.BITSNAP_PROJECT_ID ?? '',
      currency: 'PLN',
      sync: [
        { collection: 'products', fields: [] },
      ],
    }),
  ],
})
```

### 2. Regenerate the Payload artefacts — mandatory

The plugin injects fields **and** admin components, so Payload has to pick them up:

```bash
pnpm generate:importmap   # required — resolves the admin components
pnpm generate:types       # required — refreshes the generated types
```

> `generate:importmap` is what maps `bitsnap-payloadcms/client#BitsnapManager` (and the other
> admin components) to real modules. Without it the admin panel renders the default field
> instead of the Bitsnap components.

**No `next.config.js` changes are needed.** The plugin is plain Payload config — no
transpilePackages, no webpack/turbopack tweaks, no `server-only` imports.

## Configuration

| Option         | Type                          | Default                    | Description                                                        |
| -------------- | ----------------------------- | -------------------------- | ------------------------------------------------------------------ |
| `bitsnapApiKey` | `string`                     | —                          | Bitsnap API key. Server-side only — it never reaches the browser.  |
| `projectId`    | `string`                      | `process.env.BITSNAP_PROJECT_ID` | Bitsnap project the products belong to.                      |
| `dashboardUrl` | `string`                      | `https://bitsnap.pl`       | Base URL of the Bitsnap dashboard.                                 |
| `apiBasePath`  | `string`                      | `/bitsnap`                 | Path the REST endpoints are mounted on, relative to the API root.  |
| `currency`     | `string`                      | `PLN`                      | Currency used when creating products and variants.                 |
| `logs`         | `boolean`                     | `false`                    | Reserved for future use — no behaviour today.        |
| `sync`         | `SyncConfig[]`                | `[]`                       | Collections that receive the Bitsnap fields. The `fields` mapping is reserved for future use. |
| `webhooks`     | `BitsnapWebhookHandler \| BitsnapWebhookHandlers` | —             | Reserved for future use — no behaviour today.        |

The endpoints are served relative to Payload's API root (`config.routes.api`, `/api` by default),
so the default configuration exposes them at `/api/bitsnap/...`.

### Environment variables

| Variable               | Used for                                                        |
| ---------------------- | --------------------------------------------------------------- |
| `BITSNAP_API_KEY`      | Fallback API key when `bitsnapApiKey` is not set explicitly.     |
| `BITSNAP_PROJECT_ID`   | Fallback project id when `projectId` is not set explicitly.     |
| `CUSTOM_BITSNAP_HOST`  | Points the Bitsnap SDK at a self-hosted Bitsnap instance.        |

## Field helpers

### `bitsnapManagerField(pluginConfig?, overrides?, apiRoute?)`

A `ui` field that renders the Bitsnap product manager. Add it to the collection that holds
your products:

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

### `productSelectField(pluginConfig?, overrides?, apiRoute?)`

A text field that renders the Bitsnap product picker. Use it in blocks that display a single
product:

```ts
import { productSelectField } from 'bitsnap-payloadcms'

export const ProductDetails: Block = {
  slug: 'productDetails',
  fields: [productSelectField()],
}
```

Both helpers take the plugin configuration as their first argument so the admin components
receive the same `projectId`, `dashboardUrl` and `currency` the plugin uses:

```ts
import { bitsnapPluginConfig } from '@/logic/bitsnap'

fields: [bitsnapManagerField(bitsnapPluginConfig)]
```

`apiRoute` is only needed when the project changed Payload's `config.routes.api` — it defaults
to `/api`.

### `bitsnapClientConfig(pluginConfig?, apiRoute?)`

Maps a plugin configuration onto the values the admin components receive through
`clientProps` (`projectId`, `dashboardUrl`, `currency`, `apiBaseUrl`). Use it when you build
your own admin component and want the same configuration the plugin uses:

```ts
import { bitsnapClientConfig } from 'bitsnap-payloadcms'

const clientConfig = bitsnapClientConfig({ projectId: 'kL' })
// { apiBaseUrl: '/api/bitsnap', currency: 'PLN', dashboardUrl: 'https://bitsnap.pl', projectId: 'kL' }
```

## REST endpoints

All endpoints require an authenticated Payload user and answer with `401` and
`{ "error": "Brak autoryzacji" }` otherwise.

| Method | Path                          | Description                                    | Body / response                                      |
| ------ | ----------------------------- | ---------------------------------------------- | ---------------------------------------------------- |
| `POST` | `/api/bitsnap/products`       | Creates a managed product in Bitsnap.          | body → `{ id, revision }`                           |
| `GET`  | `/api/bitsnap/products/:id`   | Reads a managed product (incl. its revision).  | response → `{ product }`                            |
| `PATCH`| `/api/bitsnap/products/:id`   | Patches a managed product in Bitsnap.          | body → `{ id, revision }`                           |
| `GET`  | `/api/bitsnap/shop-products`  | Lists the products of the project.             | response → the raw Bitsnap envelope, unchanged      |

Request bodies are validated with zod. Invalid bodies answer with `400` and
`{ "error": "Nieprawidłowe dane żądania" }`.

`POST /api/bitsnap/products`:

```json
{
  "name": "Krem nawilżający",
  "priceAmount": 4999,
  "priceCurrency": "PLN",
  "status": "PUBLISHED",
  "availableQuantity": 12,
  "variants": [{ "name": "50 ml", "priceAmount": 4999 }]
}
```

`priceAmount` and `availableQuantity` are integer minor units (grosze/cents) and must not be
negative. `priceCurrency` defaults to the currency the plugin was configured with.

`PATCH /api/bitsnap/products/:id` accepts `revision`, `name`, `priceAmount`, `status`,
`availableQuantity` and `variants`. Pass the `revision` you last read to get optimistic
concurrency — a mismatch answers with `409` and
`{ "error": "Produkt zmienił się w Bitsnapie — kliknij Odśwież" }`.

## Server helpers

The server-side helpers are exported as well, so you can build your own routes or jobs:

```ts
import {
  configureBitsnapBackend,
  createManagedProduct,
  getManagedProduct,
  getShopProducts,
  updateManagedProduct,
} from 'bitsnap-payloadcms'

configureBitsnapBackend({ apiKey: process.env.BITSNAP_API_KEY })

const product = await getManagedProduct('kL', 'product-id')
const created = await createManagedProduct('kL', { name: 'Krem', priceAmount: 4999, priceCurrency: 'PLN' })
const updated = await updateManagedProduct('kL', 'product-id', { priceAmount: 5999 })
const list = await getShopProducts('kL')
```

The zod schemas used by the endpoints are exported too: `bitsnapStatusSchema`,
`bitsnapVariantSchema`, `bitsnapCreateSchema` and `bitsnapUpdateSchema`.

## Migrating from the in-repo plugin

If the plugin used to live inside your application (for example
`src/plugins/plugin-bitsnap/`), you can drop the local copy and use the published package:

1. Delete the local plugin folder and its UI components.
2. Replace the import in `src/payload.config.ts`:

   ```diff
   - import { bitsnapPlugin } from '@/plugins/plugin-bitsnap/admin'
   + import { bitsnapPlugin } from 'bitsnap-payloadcms'
   ```

3. Replace the local field imports — both helpers are **functions**, so call them with the
   shared plugin configuration:

   ```diff
   - import { bitsnapManagerField } from '@/plugins/plugin-bitsnap/fields/getFields'
   + import { bitsnapManagerField } from 'bitsnap-payloadcms'
   ```

   ```diff
   - import { productSelectField } from '@/blocks/_shared/productSelectField'
   + import { productSelectField } from 'bitsnap-payloadcms'
   ```

   ```diff
   - fields: [bitsnapManagerField],
   + fields: [bitsnapManagerField(bitsnapPluginConfig)],
   ```

   ```diff
   - export const productSelectField: Field = { name: 'productID', type: 'text', ... }
   + export const productSelectField: Field = productSelectField(bitsnapPluginConfig)
   ```

4. Delete the local API routes under `src/app/api/admin/bitsnap/` — the plugin now registers
   the same endpoints through `config.endpoints`:

   | Old route                                             | New endpoint            |
   | ----------------------------------------------------- | ----------------------- |
   | `POST   /api/admin/bitsnap/products`                  | `POST   /api/bitsnap/products`  |
   | `GET    /api/admin/bitsnap/products/:id`               | `GET    /api/bitsnap/products/:id` |
   | `PATCH  /api/admin/bitsnap/products/:id`               | `PATCH  /api/bitsnap/products/:id` |
   | `GET    /api/admin/bitsnap/shop-products`              | `GET    /api/bitsnap/shop-products` |

   The admin components call the new paths, so no other change is needed.

5. Run `pnpm generate:importmap` and `pnpm generate:types`.

## Publishing

Releases are published to npm by GitHub Actions:

1. Create an npm token with **publish** scope (an automation token or a granular token with the
   `read-package` + `write-package` permissions).
2. Add it to the repository as a secret named **`NPM_TOKEN`**.
3. Publish by creating a GitHub release — or by running the `Publish` workflow manually.

The workflow runs `pnpm build`, then `npm publish --provenance --access public`.

## License

MIT © Piotr Michalik
