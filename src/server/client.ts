import { createBitsnapClient } from 'bitsnap-js/client'

import { DEFAULT_CURRENCY, DEFAULT_HOST, DEFAULT_PRODUCTS_LIMIT } from '../constants.js'
import type {
  BitsnapAccountInfo,
  ManagedProduct,
  ShopProductsResult,
} from '../types.js'
import {
  mapAccountInfo,
  mapCreateProductRequest,
  mapManagedProduct,
  mapProductListItem,
  mapUpdateProductRequest,
} from './mappers.js'
import type { BitsnapCreateInput, BitsnapUpdateInput } from './schemas.js'

export type BitsnapServerClientOptions = {
  /**
   * Bitsnap API key (`bs_test_...` or `bs_live_...`).
   */
  apiKey: string
  /**
   * Base host URL of the Bitsnap API. Default: `https://bitsnap.pl`.
   */
  host?: string
  /**
   * Default currency used when patching prices without an explicit currency.
   */
  currency?: string
  /**
   * Optional custom `fetch` implementation (tests, proxies).
   */
  fetch?: typeof fetch
  /**
   * Request timeout in milliseconds.
   */
  timeoutMs?: number
}

export type ProductWriteResult = {
  id: string
  revision: number
  product: ManagedProduct
}

export type ListProductsParams = {
  search?: string
  cursor?: string
  limit?: number
  includeDrafts?: boolean
}

export type BitsnapServerClient = {
  readonly host: string
  getAccount: () => Promise<BitsnapAccountInfo>
  getProduct: (id: string) => Promise<ManagedProduct>
  createProduct: (input: BitsnapCreateInput) => Promise<ProductWriteResult>
  updateProduct: (id: string, patch: BitsnapUpdateInput) => Promise<ProductWriteResult>
  listProducts: (params?: ListProductsParams) => Promise<ShopProductsResult>
}

/**
 * Creates a per-instance server client backed by `bitsnap-js/client`.
 *
 * Holds no module-level state — safe for multiple plugin instances and parallel tests.
 */
export function createBitsnapServerClient(
  options: BitsnapServerClientOptions,
): BitsnapServerClient {
  const host = (options.host ?? DEFAULT_HOST).replace(/\/+$/, '') || DEFAULT_HOST
  const defaultCurrency = options.currency ?? DEFAULT_CURRENCY

  const sdk = createBitsnapClient({
    apiKey: options.apiKey,
    host,
    fetch: options.fetch,
    timeoutMs: options.timeoutMs,
  })

  let accountPromise: Promise<BitsnapAccountInfo> | null = null

  const getAccount = (): Promise<BitsnapAccountInfo> => {
    if (!accountPromise) {
      accountPromise = sdk.account
        .get()
        .then(mapAccountInfo)
        .catch((error: unknown) => {
          accountPromise = null
          throw error
        })
    }

    return accountPromise
  }

  const getProduct = async (id: string): Promise<ManagedProduct> => {
    const response = await sdk.products.get(id)
    return mapManagedProduct(response.product)
  }

  const createProduct = async (input: BitsnapCreateInput): Promise<ProductWriteResult> => {
    const response = await sdk.products.create(mapCreateProductRequest(input))
    const product = mapManagedProduct(response.product)

    return {
      id: product.id,
      revision: product.revision,
      product,
    }
  }

  const updateProduct = async (
    id: string,
    patch: BitsnapUpdateInput,
  ): Promise<ProductWriteResult> => {
    const response = await sdk.products.update(
      mapUpdateProductRequest(id, patch, defaultCurrency),
    )
    const product = mapManagedProduct(response.product)

    return {
      id: product.id,
      revision: product.revision,
      product,
    }
  }

  const listProducts = async (params?: ListProductsParams): Promise<ShopProductsResult> => {
    const response = await sdk.products.list({
      ...(params?.search ? { search: params.search } : {}),
      ...(params?.cursor ? { cursor: params.cursor } : {}),
      limit: params?.limit ?? DEFAULT_PRODUCTS_LIMIT,
      includeDrafts: params?.includeDrafts ?? false,
    })

    return {
      products: Array.isArray(response.products)
        ? response.products.map(mapProductListItem)
        : [],
      nextCursor: response.nextCursor ?? '',
    }
  }

  return {
    host: sdk.host,
    getAccount,
    getProduct,
    createProduct,
    updateProduct,
    listProducts,
  }
}
