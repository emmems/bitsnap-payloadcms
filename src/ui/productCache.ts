import type { ManagedProduct, ProductListItem, ShopProductsResult } from '../types.js'

const CACHE_TTL_MS = 60_000

type CacheEntry<T> = {
  value: T
  expiresAt: number
}

const listCache = new Map<string, CacheEntry<ShopProductsResult>>()
const listInFlight = new Map<string, Promise<ShopProductsResult>>()

const byIdCache = new Map<string, CacheEntry<ProductListItem>>()
const byIdInFlight = new Map<string, Promise<ProductListItem | null>>()

let cacheGeneration = 0

export type FetchProductsPageParams = {
  search?: string
  cursor?: string
  limit?: number
  includeDrafts?: boolean
}

function buildListKey(apiBaseUrl: string, params: FetchProductsPageParams): string {
  return JSON.stringify([
    apiBaseUrl,
    params.search?.trim() ?? '',
    params.cursor ?? '',
    params.limit ?? 50,
    Boolean(params.includeDrafts),
  ])
}

function isFresh<T>(entry: CacheEntry<T> | undefined): entry is CacheEntry<T> {
  return entry !== undefined && entry.expiresAt > Date.now()
}

function toSummary(product: ManagedProduct | ProductListItem): ProductListItem {
  if ('variantsCount' in product) {
    return product
  }

  return {
    id: product.id,
    name: product.name,
    status: product.status,
    priceAmount: product.priceAmount,
    priceCurrency: product.priceCurrency,
    imageUrl: product.images[0] ?? null,
    variantsCount: product.variants.length,
  }
}

export function primeProductSummary(product: ManagedProduct | ProductListItem): void {
  const summary = toSummary(product)
  byIdCache.set(summary.id, {
    value: summary,
    expiresAt: Date.now() + CACHE_TTL_MS,
  })
}

export function getCachedProductSummary(id: string): ProductListItem | undefined {
  const entry = byIdCache.get(id)
  if (!isFresh(entry)) {
    byIdCache.delete(id)
    return undefined
  }
  return entry.value
}

export async function fetchProductsPage(
  apiBaseUrl: string,
  params: FetchProductsPageParams = {},
): Promise<ShopProductsResult> {
  const key = buildListKey(apiBaseUrl, params)
  const cached = listCache.get(key)
  if (isFresh(cached)) {
    return cached.value
  }

  const existing = listInFlight.get(key)
  if (existing) {
    return existing
  }

  const url = new URL(`${apiBaseUrl}/shop-products`, 'http://localhost')
  if (params.search && params.search.trim() !== '') {
    url.searchParams.set('search', params.search.trim())
  }
  if (params.cursor && params.cursor !== '') {
    url.searchParams.set('cursor', params.cursor)
  }
  if (params.limit !== undefined) {
    url.searchParams.set('limit', String(params.limit))
  }
  if (params.includeDrafts) {
    url.searchParams.set('includeDrafts', 'true')
  }

  const requestUrl = `${apiBaseUrl}/shop-products${url.search}`
  const generation = cacheGeneration

  const promise = fetch(requestUrl)
    .then(async (response) => {
      const payload = (await response.json().catch(() => ({}))) as Partial<ShopProductsResult> & {
        error?: string
      }
      if (!response.ok) {
        throw new Error(payload.error ?? `Request failed (${response.status})`)
      }

      const result: ShopProductsResult = {
        products: Array.isArray(payload.products) ? payload.products : [],
        nextCursor: typeof payload.nextCursor === 'string' ? payload.nextCursor : '',
      }

      if (generation === cacheGeneration) {
        const expiresAt = Date.now() + CACHE_TTL_MS
        listCache.set(key, { value: result, expiresAt })
        for (const item of result.products) {
          byIdCache.set(item.id, { value: item, expiresAt })
        }
      }

      return result
    })
    .finally(() => {
      if (listInFlight.get(key) === promise) {
        listInFlight.delete(key)
      }
    })

  listInFlight.set(key, promise)
  return promise
}

export async function fetchProductSummary(
  apiBaseUrl: string,
  id: string,
): Promise<ProductListItem | null> {
  if (!id) {
    return null
  }

  const cached = getCachedProductSummary(id)
  if (cached) {
    return cached
  }

  const key = `${apiBaseUrl}::${id}`
  const existing = byIdInFlight.get(key)
  if (existing) {
    return existing
  }

  const generation = cacheGeneration

  const promise = fetch(`${apiBaseUrl}/products/${encodeURIComponent(id)}`)
    .then(async (response) => {
      if (!response.ok) {
        return null
      }
      const payload = (await response.json().catch(() => ({}))) as { product?: ManagedProduct }
      if (!payload.product) {
        return null
      }

      const summary = toSummary(payload.product)
      if (generation === cacheGeneration) {
        byIdCache.set(id, { value: summary, expiresAt: Date.now() + CACHE_TTL_MS })
      }
      return summary
    })
    .catch(() => null)
    .finally(() => {
      if (byIdInFlight.get(key) === promise) {
        byIdInFlight.delete(key)
      }
    })

  byIdInFlight.set(key, promise)
  return promise
}

export function invalidateProductsCache(): void {
  cacheGeneration += 1
  listCache.clear()
  listInFlight.clear()
  byIdCache.clear()
  byIdInFlight.clear()
}
