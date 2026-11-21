import { DEFAULT_API_BASE_PATH } from '../constants.js'

export function normalizeApiBasePath(value?: string): string {
  const trimmed = value?.trim().replace(/\/+$/, '') ?? ''
  if (trimmed === '') {
    return DEFAULT_API_BASE_PATH
  }
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}
