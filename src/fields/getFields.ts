import type { CollectionConfig, Field, TextField, UIField } from 'payload'

import { DEFAULT_CURRENCY, DEFAULT_HOST, DEFAULT_PRODUCT_ID_PATH } from '../constants.js'
import type {
  BitsnapClientConfig,
  BitsnapPluginConfig,
  SanitizedBitsnapPluginConfig,
  SyncConfig,
} from '../types.js'
import { normalizeApiBasePath } from '../utils/normalizeApiBasePath.js'

/**
 * Import-map paths of the admin components shipped with this package.
 *
 * Payload resolves these strings through the generated import map, so the
 * consumer has to run `payload generate:importmap` after installing the plugin.
 */
export const BITSNAP_MANAGER_COMPONENT_PATH = 'bitsnap-payloadcms/client#BitsnapManager'
export const BITSNAP_LINK_TO_DOC_COMPONENT_PATH = 'bitsnap-payloadcms/client#LinkToDoc'
export const BITSNAP_PRODUCT_SELECT_COMPONENT_PATH = 'bitsnap-payloadcms/client#ProductSelect'
export const BITSNAP_PRODUCT_ROW_LABEL_COMPONENT_PATH =
  'bitsnap-payloadcms/client#BitsnapProductRowLabel'

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

export type BitsnapManagerFieldOptions = {
  /**
   * Path of the form field storing the linked Bitsnap product ID.
   * Default: `'bitsnapID'`.
   */
  productIdPath?: string
  /**
   * Partial Payload field overrides. `admin`, `admin.components` and
   * `admin.custom` are deep-merged so overriding e.g. `admin.condition` never
   * clobbers the Bitsnap UI component.
   */
  overrides?: Partial<UIField>
}

export type ProductSelectFieldOptions = {
  /**
   * Allow selecting draft / unpublished products in addition to published ones.
   * Default: `false`.
   */
  allowDrafts?: boolean
  /**
   * Partial Payload field overrides. `admin`, `admin.components` and
   * `admin.custom` are deep-merged so overriding e.g. `admin.width` never
   * clobbers the Bitsnap UI component.
   */
  overrides?: Partial<TextField>
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeHost(value?: string): string {
  const trimmed = value?.trim().replace(/\/+$/, '') ?? ''
  return trimmed === '' ? DEFAULT_HOST : trimmed
}

/**
 * Non-mutating deep-merge for Payload field overrides.
 * Recursively preserves `admin`, `admin.components`, and `admin.custom`.
 */
export function mergeFieldOverrides<T extends Field>(base: T, overrides?: Partial<T>): T {
  if (!overrides) {
    return base
  }

  const baseRecord = base as unknown as Record<string, unknown>
  const overrideRecord = overrides as unknown as Record<string, unknown>

  const merged: Record<string, unknown> = {
    ...baseRecord,
    ...overrideRecord,
  }

  if (isPlainObject(baseRecord.admin) && isPlainObject(overrideRecord.admin)) {
    const baseAdmin = baseRecord.admin
    const overrideAdmin = overrideRecord.admin

    const mergedAdmin: Record<string, unknown> = {
      ...baseAdmin,
      ...overrideAdmin,
    }

    if (isPlainObject(baseAdmin.components) && isPlainObject(overrideAdmin.components)) {
      mergedAdmin.components = {
        ...baseAdmin.components,
        ...overrideAdmin.components,
      }
    }

    if (isPlainObject(baseAdmin.custom) && isPlainObject(overrideAdmin.custom)) {
      mergedAdmin.custom = {
        ...baseAdmin.custom,
        ...overrideAdmin.custom,
      }
    }

    merged.admin = mergedAdmin
  }

  return merged as unknown as T
}

/**
 * Maps a plugin configuration onto the public values the admin components need.
 *
 * Only non-secret values end up here — the API key is never part of the
 * client configuration.
 */
export function bitsnapClientConfig(
  pluginConfig?: Partial<BitsnapPluginConfig>,
  apiRoute: string = DEFAULT_API_ROUTE,
): BitsnapClientConfig {
  const normalizedBasePath = normalizeApiBasePath(pluginConfig?.apiBasePath)
  const currency = pluginConfig?.currency?.trim() || DEFAULT_CURRENCY
  const host = normalizeHost(
    pluginConfig?.host ?? pluginConfig?.dashboardUrl ?? process.env.CUSTOM_BITSNAP_HOST,
  )
  const projectId = pluginConfig?.projectId ?? process.env.BITSNAP_PROJECT_ID ?? ''
  const normalizedApiRoute = apiRoute.trim().replace(/\/+$/, '')

  return {
    apiBaseUrl: `${normalizedApiRoute}${normalizedBasePath}`,
    currency,
    host,
    dashboardUrl: host,
    projectId,
  }
}

/**
 * Zero-config `ui` field that renders the Bitsnap product manager inside the
 * Payload admin. Reads public plugin config automatically from
 * `config.admin.custom.bitsnap`.
 */
export function bitsnapManagerField(options?: BitsnapManagerFieldOptions): UIField {
  const productIdPath = options?.productIdPath?.trim() || DEFAULT_PRODUCT_ID_PATH

  const field: UIField = {
    name: 'bitsnapManager',
    type: 'ui',
    label: { en: 'Product in Bitsnap', pl: 'Produkt w Bitsnap' },
    admin: {
      components: {
        Field: {
          path: BITSNAP_MANAGER_COMPONENT_PATH,
        },
      },
      custom: {
        productIdPath,
      },
    },
  }

  return mergeFieldOverrides<UIField>(field, options?.overrides)
}

/**
 * Zero-config `text` field that renders the searchable, paginated Bitsnap
 * product picker. Reads public plugin config automatically from
 * `config.admin.custom.bitsnap`.
 */
export function productSelectField(options?: ProductSelectFieldOptions): TextField {
  const allowDrafts = options?.allowDrafts ?? false

  const field: TextField = {
    name: 'productID',
    type: 'text',
    label: { en: 'Product', pl: 'Produkt' },
    admin: {
      components: {
        Field: {
          path: BITSNAP_PRODUCT_SELECT_COMPONENT_PATH,
        },
      },
      custom: {
        allowDrafts,
      },
      description: {
        en: 'Bitsnap product shown by this block.',
        pl: 'Produkt Bitsnap wyświetlany w tym bloku.',
      },
      readOnly: false,
    },
    required: false,
  }

  return mergeFieldOverrides<TextField>(field, options?.overrides)
}

/**
 * Fields the plugin appends to every collection listed in `sync`.
 *
 * The collection's own fields are never replaced — the Bitsnap fields are
 * appended so the collection keeps its own schema intact.
 */
export function getFields({
  collection,
  syncConfig,
}: GetFieldsArgs): Field[] {
  const bitsnapIDField: TextField = {
    name: DEFAULT_PRODUCT_ID_PATH,
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

  const docUrlField: UIField = {
    name: 'docUrl',
    type: 'ui',
    admin: {
      components: {
        Field: {
          path: BITSNAP_LINK_TO_DOC_COMPONENT_PATH,
        },
      },
      custom: {
        nameOfIDField: DEFAULT_PRODUCT_ID_PATH,
      },
      position: 'sidebar',
    },
  }

  // The sync mapping itself is applied by the sync job — the plugin only adds
  // the fields the admin UI needs.
  void syncConfig

  return [...collection.fields, bitsnapIDField, skipSyncField, docUrlField]
}
