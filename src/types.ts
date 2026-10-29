import type { Config as PayloadConfig, Payload, PayloadRequest } from 'payload'

export type BitsnapWebhookHandler<T = any> = (args: {
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
   * Bitsnap API key. Server-side only — never sent to the browser.
   */
  bitsnapApiKey: string
  /**
   * Bitsnap project ID. Falls back to `process.env.BITSNAP_PROJECT_ID`.
   */
  projectId?: string
  /**
   * Base URL of the Bitsnap dashboard. Default: `https://bitsnap.pl`.
   */
  dashboardUrl?: string
  /**
   * Path the plugin mounts its REST endpoints on, relative to the Payload API root.
   * Default: `/bitsnap`.
   */
  apiBasePath?: string
  /**
   * Currency used when creating products and variants. Default: `PLN`.
   */
  currency?: string
  logs?: boolean
  sync?: SyncConfig[]
  webhooks?: BitsnapWebhookHandler | BitsnapWebhookHandlers
}

export type SanitizedBitsnapPluginConfig = {
  apiBasePath: string
  currency: string
  dashboardUrl: string
  projectId: string
  sync: SyncConfig[]
} & BitsnapPluginConfig

/**
 * Values the admin UI components need. Passed to them through Payload's
 * `clientProps` mechanism — see `admin.components.Field.clientProps`.
 */
export type BitsnapClientConfig = {
  /**
   * Path prefix of the plugin's REST endpoints, including the Payload API root.
   * Example: `/api/bitsnap`.
   */
  apiBaseUrl: string
  currency: string
  dashboardUrl: string
  projectId: string
}

export type BitsnapProxy = (args: {
  bitsnapArgs: any[]
  bitsnapMethod: string
  bitsnapApiKey: string
}) => Promise<{
  data?: any
  message?: string
  status: number
}>
