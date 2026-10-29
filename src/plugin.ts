import type { Config, Plugin } from 'payload'

import {
  DEFAULT_API_BASE_PATH,
  DEFAULT_CURRENCY,
  DEFAULT_DASHBOARD_URL,
} from './constants.js'
import { DEFAULT_API_ROUTE, getFields } from './fields/getFields.js'
import { configureBitsnapBackend } from './server/client.js'
import { createBitsnapEndpoints } from './server/endpoints.js'
import { setBitsnapCurrency } from './server/schemas.js'
import type { BitsnapPluginConfig, SanitizedBitsnapPluginConfig } from './types.js'

/**
 * Fills in every default the plugin needs so the rest of the code can rely on
 * a fully populated configuration.
 */
export function sanitizeBitsnapPluginConfig(
  pluginConfig: BitsnapPluginConfig,
): SanitizedBitsnapPluginConfig {
  return {
    ...pluginConfig,
    apiBasePath: pluginConfig.apiBasePath ?? DEFAULT_API_BASE_PATH,
    currency: pluginConfig.currency ?? DEFAULT_CURRENCY,
    dashboardUrl: pluginConfig.dashboardUrl ?? DEFAULT_DASHBOARD_URL,
    projectId: pluginConfig.projectId ?? process.env.BITSNAP_PROJECT_ID ?? '',
    sync: pluginConfig.sync ?? [],
  }
}

/**
 * Payload plugin that wires Bitsnap into a Payload project.
 *
 * - appends the Bitsnap fields to every collection listed in `sync`
 * - mounts the Bitsnap REST endpoints on the Payload API root
 * - points the Bitsnap SDK at the configured host and API key
 */
export const bitsnapPlugin = (pluginConfig: BitsnapPluginConfig): Plugin => {
  return (config: Config): Config => {
    const sanitized = sanitizeBitsnapPluginConfig(pluginConfig)

    setBitsnapCurrency(sanitized.currency)
    configureBitsnapBackend({ apiKey: sanitized.bitsnapApiKey })

    const apiRoute = config.routes?.api ?? DEFAULT_API_ROUTE

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

    const endpoints = [...(config.endpoints ?? []), ...createBitsnapEndpoints(sanitized)]

    return {
      ...config,
      collections,
      endpoints,
    }
  }
}
