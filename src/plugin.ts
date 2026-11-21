import type { Config, Plugin } from 'payload'

import { DEFAULT_CURRENCY, DEFAULT_HOST } from './constants.js'
import { bitsnapClientConfig, DEFAULT_API_ROUTE, getFields } from './fields/getFields.js'
import { type BitsnapServerClient, createBitsnapServerClient } from './server/client.js'
import { createBitsnapEndpoints } from './server/endpoints.js'
import type { BitsnapPluginConfig, SanitizedBitsnapPluginConfig } from './types.js'
import { normalizeApiBasePath } from './utils/normalizeApiBasePath.js'

export type BitsnapServerContext = {
  client: BitsnapServerClient | null
  config: SanitizedBitsnapPluginConfig
}

function normalizeHost(value?: string): string {
  const trimmed = value?.trim().replace(/\/+$/, '') ?? ''
  return trimmed === '' ? DEFAULT_HOST : trimmed
}

/**
 * Fills in every default the plugin needs so the rest of the code can rely on
 * a fully populated, normalized configuration.
 */
export function sanitizeBitsnapPluginConfig(
  pluginConfig: BitsnapPluginConfig,
): SanitizedBitsnapPluginConfig {
  const host = normalizeHost(
    pluginConfig.host ?? pluginConfig.dashboardUrl ?? process.env.CUSTOM_BITSNAP_HOST,
  )

  return {
    ...pluginConfig,
    apiBasePath: normalizeApiBasePath(pluginConfig.apiBasePath),
    currency: pluginConfig.currency?.trim() || DEFAULT_CURRENCY,
    host,
    dashboardUrl: host,
    projectId: pluginConfig.projectId ?? process.env.BITSNAP_PROJECT_ID ?? '',
    sync: pluginConfig.sync ?? [],
  }
}

/**
 * Payload plugin that wires Bitsnap into a Payload project.
 *
 * - stores public client configuration in `config.admin.custom.bitsnap`
 * - stores per-instance server client & sanitized config in `config.custom.bitsnap`
 * - appends the Bitsnap fields (`bitsnapID`, `skipSync`, `docUrl`) to every collection in `sync`
 * - mounts the Bitsnap REST endpoints on the Payload API root
 */
export const bitsnapPlugin = (pluginConfig: BitsnapPluginConfig): Plugin => {
  return (config: Config): Config => {
    const sanitized = sanitizeBitsnapPluginConfig(pluginConfig)
    const apiRoute = config.routes?.api ?? DEFAULT_API_ROUTE
    const publicClientConfig = bitsnapClientConfig(sanitized, apiRoute)

    const resolvedApiKey = sanitized.bitsnapApiKey || process.env.BITSNAP_API_KEY || ''
    const client =
      resolvedApiKey.trim().length > 0
        ? createBitsnapServerClient({
            apiKey: resolvedApiKey,
            host: sanitized.host,
            currency: sanitized.currency,
            fetch: sanitized.fetch,
            timeoutMs: sanitized.timeoutMs,
          })
        : null

    const collections = (config.collections ?? []).map((collection) => {
      const syncConfig = sanitized.sync.find((sync) => sync.collection === collection.slug)

      if (!syncConfig) {
        return collection
      }

      return {
        ...collection,
        fields: getFields({
          apiRoute,
          collection,
          pluginConfig: sanitized,
          syncConfig,
        }),
      }
    })

    const endpoints = [
      ...(config.endpoints ?? []),
      ...createBitsnapEndpoints(sanitized, client ?? undefined),
    ]

    const serverContext: BitsnapServerContext = {
      client,
      config: sanitized,
    }

    return {
      ...config,
      admin: {
        ...config.admin,
        custom: {
          ...config.admin?.custom,
          bitsnap: publicClientConfig,
        },
      },
      custom: {
        ...config.custom,
        bitsnap: serverContext,
      },
      collections,
      endpoints,
    }
  }
}
