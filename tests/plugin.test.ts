import type { Config } from 'payload'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { DEFAULT_API_BASE_PATH, DEFAULT_CURRENCY, DEFAULT_HOST } from '../src/constants.js'
import { bitsnapPlugin, sanitizeBitsnapPluginConfig } from '../src/plugin.js'

describe('sanitizeBitsnapPluginConfig', () => {
  const originalCustomHost = process.env.CUSTOM_BITSNAP_HOST
  const originalProjectId = process.env.BITSNAP_PROJECT_ID

  afterEach(() => {
    if (originalCustomHost === undefined) {
      delete process.env.CUSTOM_BITSNAP_HOST
    } else {
      process.env.CUSTOM_BITSNAP_HOST = originalCustomHost
    }

    if (originalProjectId === undefined) {
      delete process.env.BITSNAP_PROJECT_ID
    } else {
      process.env.BITSNAP_PROJECT_ID = originalProjectId
    }
  })

  it('applies defaults and normalizes host trailing slashes', () => {
    delete process.env.CUSTOM_BITSNAP_HOST
    delete process.env.BITSNAP_PROJECT_ID

    const sanitized = sanitizeBitsnapPluginConfig({
      bitsnapApiKey: 'bs_test_123',
      host: 'https://staging.bitsnap.pl///',
    })

    expect(sanitized.host).toBe('https://staging.bitsnap.pl')
    expect(sanitized.dashboardUrl).toBe('https://staging.bitsnap.pl')
    expect(sanitized.apiBasePath).toBe(DEFAULT_API_BASE_PATH)
    expect(sanitized.currency).toBe(DEFAULT_CURRENCY)
    expect(sanitized.projectId).toBe('')
    expect(sanitized.sync).toEqual([])
  })

  it('respects host > dashboardUrl > CUSTOM_BITSNAP_HOST > DEFAULT_HOST precedence', () => {
    process.env.CUSTOM_BITSNAP_HOST = 'https://env.bitsnap.pl/'

    expect(
      sanitizeBitsnapPluginConfig({
        bitsnapApiKey: 'bs_test_1',
        host: 'https://host.bitsnap.pl/',
        dashboardUrl: 'https://legacy.bitsnap.pl/',
      }).host,
    ).toBe('https://host.bitsnap.pl')

    expect(
      sanitizeBitsnapPluginConfig({
        bitsnapApiKey: 'bs_test_1',
        dashboardUrl: 'https://legacy.bitsnap.pl/',
      }).host,
    ).toBe('https://legacy.bitsnap.pl')

    expect(
      sanitizeBitsnapPluginConfig({
        bitsnapApiKey: 'bs_test_1',
      }).host,
    ).toBe('https://env.bitsnap.pl')

    delete process.env.CUSTOM_BITSNAP_HOST
    expect(
      sanitizeBitsnapPluginConfig({
        bitsnapApiKey: 'bs_test_1',
      }).host,
    ).toBe(DEFAULT_HOST)
  })
})

describe('bitsnapPlugin', () => {
  it('stores public config in config.admin.custom.bitsnap without secrets and server context in config.custom.bitsnap', async () => {
    const baseConfig: Config = {
      admin: {
        custom: { existingFlag: true },
      },
      custom: { existingServerValue: 42 },
      collections: [
        {
          slug: 'products',
          fields: [{ name: 'title', type: 'text' }],
        },
        {
          slug: 'pages',
          fields: [{ name: 'slug', type: 'text' }],
        },
      ],
      routes: {
        api: '/custom-api',
      },
    } as unknown as Config

    const mockFetch = vi.fn<typeof fetch>()
    const result = await bitsnapPlugin({
      bitsnapApiKey: 'bs_test_super_secret',
      host: 'https://shop.bitsnap.pl/',
      currency: 'EUR',
      projectId: 'proj_1',
      sync: [{ collection: 'products', fields: [] }],
      fetch: mockFetch,
    })(baseConfig)

    // Public admin.custom.bitsnap has no API key and preserves existing custom fields
    expect(result.admin?.custom?.existingFlag).toBe(true)
    expect(result.admin?.custom?.bitsnap).toEqual({
      apiBaseUrl: '/custom-api/bitsnap',
      currency: 'EUR',
      host: 'https://shop.bitsnap.pl',
      dashboardUrl: 'https://shop.bitsnap.pl',
      projectId: 'proj_1',
    })
    expect(JSON.stringify(result.admin?.custom)).not.toContain('bs_test_super_secret')

    // Server-only config.custom.bitsnap has client and sanitized config
    expect(result.custom?.existingServerValue).toBe(42)
    expect(result.custom?.bitsnap?.client).toBeTruthy()
    expect(result.custom?.bitsnap?.config?.host).toBe('https://shop.bitsnap.pl')

    // Only synced collection gets the 3 Bitsnap fields
    const productsCollection = result.collections?.find((c) => c.slug === 'products')
    const pagesCollection = result.collections?.find((c) => c.slug === 'pages')
    expect(productsCollection?.fields).toHaveLength(4)
    expect(pagesCollection?.fields).toHaveLength(1)

    // All 5 endpoints are mounted
    const endpointKeys = (result.endpoints ?? []).map((ep) => `${ep.method}:${ep.path}`)
    expect(endpointKeys).toEqual([
      'get:/bitsnap/account',
      'post:/bitsnap/products',
      'get:/bitsnap/products/:id',
      'patch:/bitsnap/products/:id',
      'get:/bitsnap/shop-products',
    ])
  })
})
