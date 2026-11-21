import { useConfig } from '@payloadcms/ui'

import { DEFAULT_API_BASE_PATH, DEFAULT_CURRENCY, DEFAULT_HOST } from '../constants.js'
import type { BitsnapClientConfig } from '../types.js'

/**
 * Default path of the plugin REST endpoints, relative to the Payload API root.
 * The plugin mounts its endpoints on `config.routes.api` (default `/api`).
 */
export const DEFAULT_API_BASE_URL = `/api${DEFAULT_API_BASE_PATH}`

const stripTrailingSlashes = (value: string): string => value.replace(/\/+$/, '')

const normalizeApiBaseUrl = (value: string): string => {
  const trimmed = stripTrailingSlashes(value.trim())
  return trimmed === '' ? DEFAULT_API_BASE_URL : trimmed
}

const normalizeHost = (value: string): string => {
  const trimmed = stripTrailingSlashes(value.trim())
  return trimmed === '' ? DEFAULT_HOST : trimmed
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readString(obj: Record<string, unknown>, key: string): string | undefined {
  const val = obj[key]
  return typeof val === 'string' && val.trim() !== '' ? val : undefined
}

function extractAdminBitsnapConfig(custom: unknown): Partial<BitsnapClientConfig> {
  if (!isRecord(custom) || !isRecord(custom.bitsnap)) {
    return {}
  }

  const raw = custom.bitsnap
  return {
    apiBaseUrl: readString(raw, 'apiBaseUrl'),
    currency: readString(raw, 'currency'),
    host: readString(raw, 'host'),
    dashboardUrl: readString(raw, 'dashboardUrl'),
    projectId: readString(raw, 'projectId'),
  }
}

/**
 * Pure helper that merges optional overrides with package defaults.
 * Deliberately free of React context so it can be called in unit tests.
 */
export const getBitsnapClientConfig = (
  props?: Partial<BitsnapClientConfig>,
): Required<BitsnapClientConfig> => {
  const incoming = props ?? {}
  const host = normalizeHost(incoming.host ?? incoming.dashboardUrl ?? DEFAULT_HOST)

  return {
    apiBaseUrl: normalizeApiBaseUrl(incoming.apiBaseUrl ?? DEFAULT_API_BASE_URL),
    currency: incoming.currency?.trim() || DEFAULT_CURRENCY,
    host,
    dashboardUrl: host,
    projectId: incoming.projectId?.trim() ?? '',
  }
}

/**
 * Reads the public Bitsnap client config stored by `bitsnapPlugin` in
 * `config.admin.custom.bitsnap`, merged with optional `clientProps` overrides
 * and Payload's `config.routes.api` fallback.
 */
export const useBitsnapClientConfig = (
  props?: Partial<BitsnapClientConfig>,
): Required<BitsnapClientConfig> => {
  const { config } = useConfig()
  const fromAdminCustom = extractAdminBitsnapConfig(config?.admin?.custom)

  const apiRoute =
    typeof config?.routes?.api === 'string' && config.routes.api.trim() !== ''
      ? stripTrailingSlashes(config.routes.api.trim())
      : '/api'

  const fallbackApiBaseUrl = `${apiRoute}${DEFAULT_API_BASE_PATH}`

  return getBitsnapClientConfig({
    apiBaseUrl: props?.apiBaseUrl ?? fromAdminCustom.apiBaseUrl ?? fallbackApiBaseUrl,
    currency: props?.currency ?? fromAdminCustom.currency,
    host: props?.host ?? fromAdminCustom.host ?? props?.dashboardUrl ?? fromAdminCustom.dashboardUrl,
    dashboardUrl:
      props?.dashboardUrl ?? fromAdminCustom.dashboardUrl ?? props?.host ?? fromAdminCustom.host,
    projectId: props?.projectId ?? fromAdminCustom.projectId,
  })
}
