import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ManagedProduct, ProductListItem } from '../src/types.js'
import {
  fetchProductsPage,
  fetchProductSummary,
  getCachedProductSummary,
  invalidateProductsCache,
  primeProductSummary,
} from '../src/ui/productCache.js'

const makeListItem = (overrides: Partial<ProductListItem> = {}): ProductListItem => ({
  id: 'prod_1',
  name: 'Coffee Mug',
  status: 'PUBLISHED',
  priceAmount: 4900,
  priceCurrency: 'PLN',
  imageUrl: 'https://cdn.example.com/mug.jpg',
  variantsCount: 0,
  ...overrides,
})

const makeManagedProduct = (overrides: Partial<ManagedProduct> = {}): ManagedProduct => ({
  id: 'prod_1',
  name: 'Coffee Mug',
  status: 'PUBLISHED',
  priceAmount: 4900,
  priceCurrency: 'PLN',
  availableQuantity: 10,
  images: ['https://cdn.example.com/mug.jpg'],
  variants: [],
  revision: 1,
  ...overrides,
})

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

describe('productCache', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    invalidateProductsCache()
  })

  afterEach(() => {
    invalidateProductsCache()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('caches fetchProductsPage results for the 60s TTL and refetches after expiration', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ products: [makeListItem({ name: 'v1' })], nextCursor: '' }))
      .mockResolvedValueOnce(jsonResponse({ products: [makeListItem({ name: 'v2' })], nextCursor: '' }))

    vi.stubGlobal('fetch', fetchMock)

    const first = await fetchProductsPage('/api/bitsnap', { search: 'mug' })
    expect(first.products[0].name).toBe('v1')
    expect(fetchMock).toHaveBeenCalledTimes(1)

    // Still fresh within 60s
    vi.advanceTimersByTime(59_000)
    const second = await fetchProductsPage('/api/bitsnap', { search: 'mug' })
    expect(second.products[0].name).toBe('v1')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(getCachedProductSummary('prod_1')?.name).toBe('v1')

    // Expired after 60s
    vi.advanceTimersByTime(2_000)
    expect(getCachedProductSummary('prod_1')).toBeUndefined()

    const third = await fetchProductsPage('/api/bitsnap', { search: 'mug' })
    expect(third.products[0].name).toBe('v2')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('deduplicates concurrent in-flight requests for fetchProductsPage and fetchProductSummary', async () => {
    let resolveList!: (value: Response) => void
    let resolveItem!: (value: Response) => void

    const fetchMock = vi.fn<typeof fetch>((input) => {
      const url = String(input)
      if (url.includes('/shop-products')) {
        return new Promise<Response>((resolve) => {
          resolveList = resolve
        })
      }
      return new Promise<Response>((resolve) => {
        resolveItem = resolve
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const listP1 = fetchProductsPage('/api/bitsnap', { limit: 20 })
    const listP2 = fetchProductsPage('/api/bitsnap', { limit: 20 })
    expect(fetchMock).toHaveBeenCalledTimes(1)

    resolveList(jsonResponse({ products: [makeListItem()], nextCursor: 'next_1' }))
    const [listR1, listR2] = await Promise.all([listP1, listP2])
    expect(listR1).toEqual(listR2)
    expect(listR1.nextCursor).toBe('next_1')

    const itemP1 = fetchProductSummary('/api/bitsnap', 'prod_2')
    const itemP2 = fetchProductSummary('/api/bitsnap', 'prod_2')
    expect(fetchMock).toHaveBeenCalledTimes(2)

    resolveItem(jsonResponse({ product: makeManagedProduct({ id: 'prod_2', name: 'Tee' }) }))
    const [itemR1, itemR2] = await Promise.all([itemP1, itemP2])
    expect(itemR1).toEqual(itemR2)
    expect(itemR1?.name).toBe('Tee')
  })

  it('does not write stale in-flight fetchProductsPage or fetchProductSummary data after invalidateProductsCache', async () => {
    let resolveStaleList!: (value: Response) => void
    let resolveStaleItem!: (value: Response) => void

    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            resolveStaleList = resolve
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            resolveStaleItem = resolve
          }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ products: [makeListItem({ name: 'Fresh List' })], nextCursor: '' }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ product: makeManagedProduct({ id: 'prod_9', name: 'Fresh Item' }) }),
      )

    vi.stubGlobal('fetch', fetchMock)

    const staleListPromise = fetchProductsPage('/api/bitsnap')
    const staleItemPromise = fetchProductSummary('/api/bitsnap', 'prod_9')

    // Invalidate while both requests are still in flight
    invalidateProductsCache()

    // Resolve stale requests after invalidation
    resolveStaleList(jsonResponse({ products: [makeListItem({ name: 'Stale List' })], nextCursor: '' }))
    resolveStaleItem(
      jsonResponse({ product: makeManagedProduct({ id: 'prod_9', name: 'Stale Item' }) }),
    )

    const staleList = await staleListPromise
    const staleItem = await staleItemPromise
    expect(staleList.products[0].name).toBe('Stale List')
    expect(staleItem?.name).toBe('Stale Item')

    // Neither stale response should have been written to the caches
    expect(getCachedProductSummary('prod_1')).toBeUndefined()
    expect(getCachedProductSummary('prod_9')).toBeUndefined()

    // Subsequent calls fetch fresh data
    const freshList = await fetchProductsPage('/api/bitsnap')
    const freshItem = await fetchProductSummary('/api/bitsnap', 'prod_9')
    expect(freshList.products[0].name).toBe('Fresh List')
    expect(freshItem?.name).toBe('Fresh Item')
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })

  it('handles fetchProductSummary conversion, priming, and error responses gracefully', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({
          product: makeManagedProduct({
            id: 'prod_10',
            name: 'Hoodie',
            images: ['https://cdn.example.com/hoodie.jpg', 'https://cdn.example.com/back.jpg'],
            variants: [
              { id: 'v1', name: 'M', priceAmount: 19900, priceCurrency: 'PLN', availableQuantity: 5 },
              { id: 'v2', name: 'L', priceAmount: 19900, priceCurrency: 'PLN', availableQuantity: 3 },
            ],
          }),
        }),
      )
      .mockResolvedValueOnce(new Response('Bad Gateway', { status: 502 }))
      .mockResolvedValueOnce(new Response('not json', { status: 200 }))
      .mockResolvedValueOnce(new Response('Service Unavailable', { status: 503 }))

    vi.stubGlobal('fetch', fetchMock)

    expect(await fetchProductSummary('/api/bitsnap', '')).toBeNull()

    const summary = await fetchProductSummary('/api/bitsnap', 'prod_10')
    expect(summary).toEqual({
      id: 'prod_10',
      name: 'Hoodie',
      status: 'PUBLISHED',
      priceAmount: 4900,
      priceCurrency: 'PLN',
      imageUrl: 'https://cdn.example.com/hoodie.jpg',
      variantsCount: 2,
    })
    expect(getCachedProductSummary('prod_10')).toEqual(summary)

    // Non-OK response returns null
    expect(await fetchProductSummary('/api/bitsnap', 'prod_404')).toBeNull()

    // Malformed JSON response returns null without throwing
    expect(await fetchProductSummary('/api/bitsnap', 'prod_bad_json')).toBeNull()

    // Non-JSON error response in fetchProductsPage throws a clean status error (not SyntaxError)
    await expect(fetchProductsPage('/api/bitsnap', { search: 'fail' })).rejects.toThrow(
      'Request failed (503)',
    )

    // primeProductSummary populates byIdCache without fetching
    primeProductSummary(makeManagedProduct({ id: 'prod_primed', name: 'Primed' }))
    expect(getCachedProductSummary('prod_primed')?.name).toBe('Primed')
  })
})
