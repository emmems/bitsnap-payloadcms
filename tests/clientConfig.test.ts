import { describe, expect, it, vi } from 'vitest'

vi.mock('@payloadcms/ui', () => ({
  useConfig: vi.fn(),
  useTranslation: vi.fn(),
}))

import { DEFAULT_API_BASE_PATH, DEFAULT_CURRENCY, DEFAULT_HOST } from '../src/constants.js'
import { bitsnapClientConfig } from '../src/fields/getFields.js'
import { DEFAULT_API_BASE_URL, getBitsnapClientConfig } from '../src/ui/getBitsnapClientConfig.js'
import { getBitsnapStrings } from '../src/ui/i18n.js'
import { normalizeApiBasePath } from '../src/utils/normalizeApiBasePath.js'

describe('getBitsnapClientConfig', () => {
  it('returns defaults when called with no arguments or blank values', () => {
    expect(getBitsnapClientConfig()).toEqual({
      apiBaseUrl: DEFAULT_API_BASE_URL,
      currency: DEFAULT_CURRENCY,
      host: DEFAULT_HOST,
      dashboardUrl: DEFAULT_HOST,
      projectId: '',
    })

    expect(
      getBitsnapClientConfig({
        apiBaseUrl: '   ///  ',
        currency: '   ',
        host: '   ',
        projectId: '  ',
      }),
    ).toEqual({
      apiBaseUrl: DEFAULT_API_BASE_URL,
      currency: DEFAULT_CURRENCY,
      host: DEFAULT_HOST,
      dashboardUrl: DEFAULT_HOST,
      projectId: '',
    })
  })

  it('trims values, strips trailing slashes, and falls back from host to dashboardUrl', () => {
    expect(
      getBitsnapClientConfig({
        apiBaseUrl: ' /custom-api/bitsnap/// ',
        currency: ' EUR ',
        host: ' https://shop.bitsnap.pl/// ',
        projectId: ' proj_123 ',
      }),
    ).toEqual({
      apiBaseUrl: '/custom-api/bitsnap',
      currency: 'EUR',
      host: 'https://shop.bitsnap.pl',
      dashboardUrl: 'https://shop.bitsnap.pl',
      projectId: 'proj_123',
    })

    expect(
      getBitsnapClientConfig({
        dashboardUrl: 'https://legacy.bitsnap.pl/',
      }),
    ).toMatchObject({
      host: 'https://legacy.bitsnap.pl',
      dashboardUrl: 'https://legacy.bitsnap.pl',
    })
  })
})

describe('normalizeApiBasePath and bitsnapClientConfig', () => {
  it('normalizes empty, whitespace, root slash, and untrimmed paths consistently', () => {
    expect(normalizeApiBasePath(undefined)).toBe(DEFAULT_API_BASE_PATH)
    expect(normalizeApiBasePath('')).toBe(DEFAULT_API_BASE_PATH)
    expect(normalizeApiBasePath('   ')).toBe(DEFAULT_API_BASE_PATH)
    expect(normalizeApiBasePath('/')).toBe(DEFAULT_API_BASE_PATH)
    expect(normalizeApiBasePath('///')).toBe(DEFAULT_API_BASE_PATH)
    expect(normalizeApiBasePath('  custom/bitsnap/  ')).toBe('/custom/bitsnap')
    expect(normalizeApiBasePath('/custom/bitsnap///')).toBe('/custom/bitsnap')

    expect(bitsnapClientConfig({ apiBasePath: '' }).apiBaseUrl).toBe('/api/bitsnap')
    expect(bitsnapClientConfig({ apiBasePath: '   ' }).apiBaseUrl).toBe('/api/bitsnap')
    expect(bitsnapClientConfig({ apiBasePath: '/' }).apiBaseUrl).toBe('/api/bitsnap')
    expect(bitsnapClientConfig({ apiBasePath: '  store/bitsnap/ ' }, '/cms-api/').apiBaseUrl).toBe(
      '/cms-api/store/bitsnap',
    )
  })
})

describe('getBitsnapStrings', () => {
  it('returns Polish strings for pl locales and falls back to English for all others', () => {
    expect(getBitsnapStrings('pl').locale).toBe('pl-PL')
    expect(getBitsnapStrings('pl-PL').locale).toBe('pl-PL')
    expect(getBitsnapStrings('PL').locale).toBe('pl-PL')

    expect(getBitsnapStrings('en').locale).toBe('en-US')
    expect(getBitsnapStrings('en-US').locale).toBe('en-US')
    expect(getBitsnapStrings('de').locale).toBe('en-US')
    expect(getBitsnapStrings('').locale).toBe('en-US')
    expect(getBitsnapStrings(undefined).locale).toBe('en-US')
  })
})
