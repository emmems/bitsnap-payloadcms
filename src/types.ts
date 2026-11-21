import type { Config as PayloadConfig, Payload, PayloadRequest } from 'payload'

export type BitsnapAccessArgs = {
  req: PayloadRequest
}

export type BitsnapAccess = (args: BitsnapAccessArgs) => boolean | Promise<boolean>

export type BitsnapWebhookHandler<T = unknown> = (args: {
  config: PayloadConfig
  event: T
  payload: Payload
  pluginConfig?: BitsnapPluginConfig
  req: PayloadRequest
}) => Promise<void> | void

export type BitsnapWebhookHandlers = {
  [webhookName: string]: BitsnapWebhookHandler
}

export type FieldSyncConfig = {
  fieldPath: string
  bitsnapProperty: string
}

export type SyncConfig = {
  collection: string
  fields: FieldSyncConfig[]
}

export type BitsnapPluginConfig = {
  /**
   * Bitsnap API key (`bs_test_...` or `bs_live_...`).
   * Server-side only — never sent to the browser.
   */
  bitsnapApiKey: string
  /**
   * Single source of truth for the Bitsnap API and dashboard URL.
   * Fallback order: `host` -> `dashboardUrl` -> `process.env.CUSTOM_BITSNAP_HOST` -> `https://bitsnap.pl`.
   */
  host?: string
  /**
   * @deprecated Use `host` instead. Kept as a fallback alias when `host` is not set.
   */
  dashboardUrl?: string
  /**
   * Optional Bitsnap project ID. Falls back to `process.env.BITSNAP_PROJECT_ID`
   * and is automatically detected from `AccountService.GetAccount` at runtime.
   */
  projectId?: string
  /**
   * Path the plugin mounts its REST endpoints on, relative to the Payload API root.
   * Default: `/bitsnap`.
   */
  apiBasePath?: string
  /**
   * Currency used when creating products and variants. Default: `PLN`.
   */
  currency?: string
  /**
   * Access control function for the Bitsnap REST endpoints.
   * Defaults to allowing only authenticated admin users (`req.user.collection === req.payload.config.admin.user`).
   */
  access?: BitsnapAccess
  /**
   * Optional custom `fetch` implementation passed to the Bitsnap API client (useful for tests/proxies).
   */
  fetch?: typeof fetch
  /**
   * Optional request timeout in milliseconds for Bitsnap API calls.
   */
  timeoutMs?: number
  logs?: boolean
  sync?: SyncConfig[]
  webhooks?: BitsnapWebhookHandler | BitsnapWebhookHandlers
}

export type SanitizedBitsnapPluginConfig = {
  apiBasePath: string
  currency: string
  host: string
  dashboardUrl: string
  projectId: string
  sync: SyncConfig[]
} & BitsnapPluginConfig

/**
 * Public values the admin UI components need.
 * Stored by `bitsnapPlugin` in `config.admin.custom.bitsnap` and never contains secrets.
 */
export type BitsnapClientConfig = {
  /**
   * Path prefix of the plugin's REST endpoints, including the Payload API root.
   * Example: `/api/bitsnap`.
   */
  apiBaseUrl: string
  currency: string
  host: string
  dashboardUrl: string
  projectId: string
}

export type BitsnapStatus = 'DRAFT' | 'UNPUBLISHED' | 'PUBLISHED'

export type BitsnapEnvironment = 'live' | 'test' | 'unknown'

export type BitsnapAccountInfo = {
  projectId: string
  projectName: string
  environment: BitsnapEnvironment
  canWrite: boolean
  scopes: string[]
}

export type ManagedVariant = {
  id: string
  name: string
  priceAmount: number | null
  priceCurrency: string | null
  availableQuantity: number | null
}

export type ManagedProduct = {
  id: string
  name: string
  status: BitsnapStatus
  priceAmount: number | null
  priceCurrency: string | null
  availableQuantity: number | null
  images: string[]
  variants: ManagedVariant[]
  revision: number
}

export type ProductListItem = {
  id: string
  name: string
  status: BitsnapStatus
  priceAmount: number | null
  priceCurrency: string | null
  imageUrl: string | null
  variantsCount: number
}

export type ShopProductsResult = {
  products: ProductListItem[]
  nextCursor: string
}

export type BitsnapProxy = (args: {
  bitsnapArgs: unknown[]
  bitsnapMethod: string
  bitsnapApiKey: string
}) => Promise<{
  data?: unknown
  message?: string
  status: number
}>
