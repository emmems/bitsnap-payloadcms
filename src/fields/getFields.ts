import type { CollectionConfig, Field } from 'payload'

import {
  DEFAULT_API_BASE_PATH,
  DEFAULT_CURRENCY,
  DEFAULT_DASHBOARD_URL,
} from '../constants.js'
import type {
  BitsnapClientConfig,
  BitsnapPluginConfig,
  SanitizedBitsnapPluginConfig,
  SyncConfig,
} from '../types.js'

/**
 * Import-map paths of the admin components shipped with this package.
 *
 * Payload resolves these strings through the generated import map, so the
 * consumer has to run `payload generate:importmap` after installing the plugin.
 */
export const BITSNAP_MANAGER_COMPONENT_PATH = 'bitsnap-payloadcms/client#BitsnapManager'
export const BITSNAP_LINK_TO_DOC_COMPONENT_PATH = 'bitsnap-payloadcms/client#LinkToDoc'
export const BITSNAP_PRODUCT_SELECT_COMPONENT_PATH = 'bitsnap-payloadcms/client#ProductSelect'

/**
 * Default Payload REST API root. Mirrors Payload's own `config.routes.api` default.
 */
export const DEFAULT_API_ROUTE = '/api'

export type GetFieldsArgs = {
  /**
   * Payload REST API root, e.g. `/api`. Used to build the absolute path of the
   * plugin endpoints that the admin components call.
   */
  apiRoute?: string
  collection: CollectionConfig
  pluginConfig: SanitizedBitsnapPluginConfig
  syncConfig: SyncConfig
}

/**
 * Maps a plugin configuration onto the values the admin components need.
 *
 * Only non-secret values end up here — the API key is never part of the
 * client configuration.
 */
export function bitsnapClientConfig(
  pluginConfig?: Partial<BitsnapPluginConfig>,
  apiRoute: string = DEFAULT_API_ROUTE,
): BitsnapClientConfig {
  const apiBasePath = pluginConfig?.apiBasePath ?? DEFAULT_API_BASE_PATH
  const currency = pluginConfig?.currency ?? DEFAULT_CURRENCY
  const dashboardUrl = pluginConfig?.dashboardUrl ?? DEFAULT_DASHBOARD_URL
  const projectId = pluginConfig?.projectId ?? process.env.BITSNAP_PROJECT_ID ?? ''
  const normalizedApiRoute = apiRoute.endsWith('/') ? apiRoute.slice(0, -1) : apiRoute

  return {
    apiBaseUrl: `${normalizedApiRoute}${apiBasePath}`,
    currency,
    dashboardUrl,
    projectId,
  }
}

/**
 * `ui` field that renders the Bitsnap product manager inside the Payload admin.
 *
 * `apiRoute` is only needed when the consuming project changed Payload's
 * `config.routes.api` — it defaults to `/api`.
 */
export function bitsnapManagerField(
  pluginConfig?: Partial<BitsnapPluginConfig>,
  overrides?: Partial<Field>,
  apiRoute?: string,
): Field {
  const field: Field = {
    name: 'bitsnapManager',
    type: 'ui',
    label: { en: 'Product in Bitsnap', pl: 'Produkt w Bitsnap' },
    admin: {
      components: {
        Field: {
          path: BITSNAP_MANAGER_COMPONENT_PATH,
          clientProps: bitsnapClientConfig(pluginConfig, apiRoute),
        },
      },
    },
  }

  return applyOverrides(field, overrides)
}

/**
 * Text field that renders the Bitsnap product picker. Meant for blocks that
 * display a single Bitsnap product.
 *
 * `apiRoute` is only needed when the consuming project changed Payload's
 * `config.routes.api` — it defaults to `/api`.
 */
export function productSelectField(
  pluginConfig?: Partial<BitsnapPluginConfig>,
  overrides?: Partial<Field>,
  apiRoute?: string,
): Field {
  const field: Field = {
    name: 'productID',
    type: 'text',
    label: { en: 'Product', pl: 'Produkt' },
    admin: {
      components: {
        Field: {
          path: BITSNAP_PRODUCT_SELECT_COMPONENT_PATH,
          clientProps: bitsnapClientConfig(pluginConfig, apiRoute),
        },
      },
      description: {
        en: 'Bitsnap product shown by this block.',
        pl: 'Produkt Bitsnap wyświetlany w tym bloku.',
      },
      readOnly: false,
    },
    required: false,
  }

  return applyOverrides(field, overrides)
}

/**
 * Fields the plugin appends to every collection listed in `sync`.
 *
 * The collection's own fields are never replaced — the Bitsnap fields are
 * appended so the collection keeps its own schema intact.
 */
export function getFields({
  apiRoute,
  collection,
  pluginConfig,
  syncConfig,
}: GetFieldsArgs): Field[] {
  const bitsnapIDField: Field = {
    name: 'bitsnapID',
    type: 'text',
    admin: {
      position: 'sidebar',
      readOnly: true,
    },
    label: { en: 'Bitsnap Product Id', pl: 'ID produktu Bitsnap' },
    saveToJWT: true,
  }

  const skipSyncField: Field = {
    name: 'skipSync',
    type: 'checkbox',
    admin: {
      position: 'sidebar',
      readOnly: true,
    },
    label: { en: 'Skip Sync', pl: 'Pomiń synchronizację' },
  }

  const docUrlField: Field = {
    name: 'docUrl',
    type: 'ui',
    admin: {
      components: {
        Field: {
          path: BITSNAP_LINK_TO_DOC_COMPONENT_PATH,
          clientProps: bitsnapClientConfig(pluginConfig, apiRoute),
        },
      },
      custom: {
        nameOfIDField: 'bitsnapID',
      },
      position: 'sidebar',
    },
  }

  // The sync mapping itself is applied by the sync job — the plugin only adds
  // the fields the admin UI needs.
  void syncConfig

  return [...collection.fields, bitsnapIDField, skipSyncField, docUrlField]
}

function applyOverrides(field: Field, overrides?: Partial<Field>): Field {
  if (!overrides) {
    return field
  }

  return Object.assign(field, overrides)
}
