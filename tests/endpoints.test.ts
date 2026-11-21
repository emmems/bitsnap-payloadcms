import type { Endpoint, PayloadRequest } from 'payload'
import { describe, expect, it, vi } from 'vitest'

import { sanitizeBitsnapPluginConfig } from '../src/plugin.js'
import { createBitsnapEndpoints } from '../src/server/endpoints.js'

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}

function createMockReq(overrides: {
  user?: { id: string; collection: string } | null
  adminUserCollection?: string
  url?: string
  routeParams?: Record<string, string>
  body?: unknown
} = {}): PayloadRequest {
  const adminUserCollection = overrides.adminUserCollection ?? 'users'
  const req = {
    user: overrides.user === undefined ? { id: 'u1', collection: adminUserCollection } : overrides.user,
    url: overrides.url ?? 'http://localhost/api/bitsnap/shop-products',
    routeParams: overrides.routeParams,
    payload: {
      config: {
        admin: {
          user: adminUserCollection,
        },
      },
    },
    json: overrides.body !== undefined ? async () => overrides.body : undefined,
  }

  return req as unknown as PayloadRequest
}

function findEndpoint(endpoints: Endpoint[], method: string, path: string): Endpoint {
  const found = endpoints.find((ep) => ep.method === method && ep.path === path)
  if (!found) {
    throw new Error(`Endpoint not found: ${method} ${path}`)
  }
  return found
}

describe('createBitsnapEndpoints', () => {
  it('enforces defaultBitsnapAccess (401 unauthenticated, 403 non-admin collection)', async () => {
    const mockFetch = vi.fn<typeof fetch>()
    const config = sanitizeBitsnapPluginConfig({
      bitsnapApiKey: 'bs_test_key',
      fetch: mockFetch,
    })
    const endpoints = createBitsnapEndpoints(config)
    const accountEp = findEndpoint(endpoints, 'get', '/bitsnap/account')

    const res401 = await accountEp.handler(createMockReq({ user: null }))
    expect(res401.status).toBe(401)

    const res403 = await accountEp.handler(
      createMockReq({ user: { id: 'c1', collection: 'customers' } }),
    )
    expect(res403.status).toBe(403)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('supports custom access control', async () => {
    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        projectId: 'proj_1',
        projectName: 'Demo Shop',
        environment: 'ENVIRONMENT_TEST',
        credentialType: 'CREDENTIAL_TYPE_API_KEY',
        scopes: ['products:read'],
        canWrite: false,
      }),
    )

    const config = sanitizeBitsnapPluginConfig({
      bitsnapApiKey: 'bs_test_key',
      fetch: mockFetch,
      access: async ({ req }) => req.user?.collection === 'editors',
    })
    const endpoints = createBitsnapEndpoints(config)
    const accountEp = findEndpoint(endpoints, 'get', '/bitsnap/account')

    const denied = await accountEp.handler(
      createMockReq({ user: { id: 'u1', collection: 'users' } }),
    )
    expect(denied.status).toBe(403)

    const allowed = await accountEp.handler(
      createMockReq({ user: { id: 'e1', collection: 'editors' } }),
    )
    expect(allowed.status).toBe(200)
    const body = (await allowed.json()) as Record<string, unknown>
    expect(body).toEqual({
      projectId: 'proj_1',
      projectName: 'Demo Shop',
      environment: 'test',
      canWrite: false,
      scopes: ['products:read'],
    })
  })

  it('caches GET /account in flight and resets cache on error', async () => {
    let calls = 0
    const mockFetch = vi.fn<typeof fetch>().mockImplementation(async () => {
      calls += 1
      if (calls === 1) {
        return jsonResponse({ code: 'internal', message: '[internal] boom' }, 500)
      }
      return jsonResponse({
        projectId: 'proj_2',
        projectName: 'Live Shop',
        environment: 'ENVIRONMENT_LIVE',
        credentialType: 'CREDENTIAL_TYPE_API_KEY',
        scopes: ['products:read', 'products:write'],
        canWrite: true,
      })
    })

    const config = sanitizeBitsnapPluginConfig({
      bitsnapApiKey: 'bs_live_key',
      fetch: mockFetch,
    })
    const endpoints = createBitsnapEndpoints(config)
    const accountEp = findEndpoint(endpoints, 'get', '/bitsnap/account')

    // First call fails -> cache resets
    const first = await accountEp.handler(createMockReq())
    expect(first.status).toBe(500)

    // Parallel calls after recovery deduplicate into a single upstream fetch
    const [second, third] = await Promise.all([
      accountEp.handler(createMockReq()),
      accountEp.handler(createMockReq()),
    ])
    expect(second.status).toBe(200)
    expect(third.status).toBe(200)
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('lists shop products with validated query params and maps Product -> ProductListItem', async () => {
    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        products: [
          {
            id: 'prod_1',
            name: 'T-shirt',
            status: 'PRODUCT_STATUS_PUBLISHED',
            price: { amount: 7900, currency: 'PLN' },
            images: ['https://cdn.example.com/tshirt.jpg'],
            variants: [{ id: 'v1', name: 'M', price: { amount: 7900, currency: 'PLN' } }],
            revision: 2,
          },
        ],
        nextCursor: 'cursor_next',
      }),
    )

    const config = sanitizeBitsnapPluginConfig({
      bitsnapApiKey: 'bs_test_key',
      host: 'https://api.example.com',
      fetch: mockFetch,
    })
    const endpoints = createBitsnapEndpoints(config)
    const listEp = findEndpoint(endpoints, 'get', '/bitsnap/shop-products')

    // Invalid limit -> 400 with issues
    const badRes = await listEp.handler(
      createMockReq({ url: 'http://localhost/api/bitsnap/shop-products?limit=999' }),
    )
    expect(badRes.status).toBe(400)
    const badJson = (await badRes.json()) as { issues: unknown[] }
    expect(Array.isArray(badJson.issues)).toBe(true)

    const okRes = await listEp.handler(
      createMockReq({
        url: 'http://localhost/api/bitsnap/shop-products?search=shirt&limit=20&cursor=c1&includeDrafts=true',
      }),
    )
    expect(okRes.status).toBe(200)
    const okJson = (await okRes.json()) as Record<string, unknown>
    expect(okJson).toEqual({
      products: [
        {
          id: 'prod_1',
          name: 'T-shirt',
          status: 'PUBLISHED',
          priceAmount: 7900,
          priceCurrency: 'PLN',
          imageUrl: 'https://cdn.example.com/tshirt.jpg',
          variantsCount: 1,
        },
      ],
      nextCursor: 'cursor_next',
    })

    const [calledUrl, calledInit] = mockFetch.mock.calls[0]
    expect(calledUrl).toBe('https://api.example.com/api/v1/bitsnap.v1.ProductsService/ListProducts')
    expect(JSON.parse(String(calledInit?.body))).toEqual({
      search: 'shirt',
      cursor: 'c1',
      limit: 20,
      includeDrafts: true,
    })
  })

  it('creates, reads, and patches products and propagates Retry-After on rate_limited', async () => {
    const mockFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({
          product: {
            id: 'prod_new',
            name: 'Mug',
            status: 'PRODUCT_STATUS_DRAFT',
            price: { amount: 2500, currency: 'EUR' },
            availableQuantity: 10,
            images: ['https://cdn.example.com/mug.jpg'],
            variants: [],
            revision: 1,
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          product: {
            id: 'prod_new',
            name: 'Mug',
            status: 'PRODUCT_STATUS_PUBLISHED',
            price: { amount: 2900, currency: 'EUR' },
            availableQuantity: 8,
            images: ['https://cdn.example.com/mug.jpg'],
            variants: [],
            revision: 2,
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          {
            code: 'resource_exhausted',
            message: '[rate_limited] slow down',
          },
          429,
          { 'retry-after': '15', 'x-request-id': 'req_rate' },
        ),
      )

    const config = sanitizeBitsnapPluginConfig({
      bitsnapApiKey: 'bs_test_key',
      currency: 'EUR',
      fetch: mockFetch,
    })
    const endpoints = createBitsnapEndpoints(config)
    const createEp = findEndpoint(endpoints, 'post', '/bitsnap/products')
    const patchEp = findEndpoint(endpoints, 'patch', '/bitsnap/products/:id')
    const readEp = findEndpoint(endpoints, 'get', '/bitsnap/products/:id')

    const created = await createEp.handler(
      createMockReq({
        body: {
          name: 'Mug',
          priceAmount: 2500,
          availableQuantity: 10,
          images: ['https://cdn.example.com/mug.jpg'],
        },
      }),
    )
    expect(created.status).toBe(200)
    const createdJson = (await created.json()) as {
      id: string
      revision: number
      product: { priceCurrency: string }
    }
    expect(createdJson.id).toBe('prod_new')
    expect(createdJson.revision).toBe(1)
    expect(createdJson.product.priceCurrency).toBe('EUR')

    const updated = await patchEp.handler(
      createMockReq({
        routeParams: { id: 'prod_new' },
        body: { revision: 1, status: 'PUBLISHED', priceAmount: 2900 },
      }),
    )
    expect(updated.status).toBe(200)
    const updatedJson = (await updated.json()) as { revision: number }
    expect(updatedJson.revision).toBe(2)

    const rateLimited = await readEp.handler(
      createMockReq({ routeParams: { id: 'prod_new' } }),
    )
    expect(rateLimited.status).toBe(429)
    expect(rateLimited.headers.get('Retry-After')).toBe('15')
    const rateJson = (await rateLimited.json()) as {
      reason: string
      requestId: string
      retryAfter: number
    }
    expect(rateJson.reason).toBe('rate_limited')
    expect(rateJson.requestId).toBe('req_rate')
    expect(rateJson.retryAfter).toBe(15)
  })
})
