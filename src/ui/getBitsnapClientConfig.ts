import { DEFAULT_API_BASE_PATH, DEFAULT_CURRENCY, DEFAULT_DASHBOARD_URL } from '../constants.js'
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

const normalizeDashboardUrl = (value: string): string => {
  const trimmed = stripTrailingSlashes(value.trim())
  return trimmed === '' ? DEFAULT_DASHBOARD_URL : trimmed
}

/**
 * Merges the configuration coming from Payload's `clientProps` with the package defaults.
 *
 * It is deliberately a plain function (no `useConfig()`, no context) so it can be called
 * from anywhere — including outside of a Payload `ConfigProvider`.
 */
export const getBitsnapClientConfig = (
  props?: Partial<BitsnapClientConfig>,
): Required<BitsnapClientConfig> => {
  const incoming = props ?? {}

  return {
    apiBaseUrl: normalizeApiBaseUrl(incoming.apiBaseUrl ?? DEFAULT_API_BASE_URL),
    currency: incoming.currency?.trim() || DEFAULT_CURRENCY,
    dashboardUrl: normalizeDashboardUrl(incoming.dashboardUrl ?? DEFAULT_DASHBOARD_URL),
    projectId: incoming.projectId?.trim() ?? '',
  }
}
