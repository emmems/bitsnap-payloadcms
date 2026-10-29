import * as BitsnapBackend from 'bitsnap-js/backend'
import type {
  CreateProductInput,
  ManagedProduct,
  ProductWriteResult,
  UpdateProductInput,
} from 'bitsnap-js/backend'

import { DEFAULT_PRODUCTS_LIMIT } from '../constants.js'

export type ConfigureBitsnapBackendArgs = {
  /**
   * Bitsnap API key. Falls back to the key the plugin was configured with and
   * finally to `process.env.BITSNAP_API_KEY`.
   */
  apiKey?: string
}

/**
 * Raw envelope returned by the Bitsnap product list endpoint.
 */
export type ShopProductsResult = Awaited<ReturnType<typeof BitsnapBackend.getProducts>>

let configuredApiKey: string | null = null

/**
 * Resolves the API key that should be used for the Bitsnap calls.
 *
 * Order: explicit argument → key the plugin was configured with →
 * `process.env.BITSNAP_API_KEY`.
 */
export function resolveBitsnapApiKey(apiKey?: string): string {
  if (typeof apiKey === 'string' && apiKey.length > 0) {
    return apiKey
  }

  if (typeof configuredApiKey === 'string' && configuredApiKey.length > 0) {
    return configuredApiKey
  }

  return process.env.BITSNAP_API_KEY ?? ''
}

/**
 * True when a Bitsnap API key is available. Drafts can only be listed with a key.
 */
export function isBitsnapApiKeyConfigured(apiKey?: string): boolean {
  return resolveBitsnapApiKey(apiKey).length > 0
}

/**
 * Points the Bitsnap SDK at the right host and gives it the API key.
 */
export function configureBitsnapBackend({ apiKey }: ConfigureBitsnapBackendArgs = {}): void {
  const resolvedApiKey = resolveBitsnapApiKey(apiKey)
  configuredApiKey = resolvedApiKey

  const customHost = process.env.CUSTOM_BITSNAP_HOST
  if (customHost != null && customHost.length > 0) {
    void BitsnapBackend.setCustomHost(customHost)
  }

  void BitsnapBackend.setApiKey(resolvedApiKey)
}

/**
 * Reads a single managed product (including its `revision`) from Bitsnap.
 */
export async function getManagedProduct(
  projectId: string,
  productId: string,
): Promise<ManagedProduct> {
  configureBitsnapBackend()

  return BitsnapBackend.getManagedProduct(projectId, productId)
}

/**
 * Creates a managed product in Bitsnap.
 */
export async function createManagedProduct(
  projectId: string,
  input: CreateProductInput,
): Promise<ProductWriteResult> {
  configureBitsnapBackend()

  return BitsnapBackend.createProduct(projectId, input)
}

/**
 * Patches a managed product in Bitsnap.
 */
export async function updateManagedProduct(
  projectId: string,
  productId: string,
  patch: UpdateProductInput,
): Promise<ProductWriteResult> {
  configureBitsnapBackend()

  return BitsnapBackend.updateProduct(projectId, productId, patch)
}

/**
 * Lists the products of a Bitsnap project.
 *
 * Drafts are only included when an API key is configured — the public endpoint
 * does not serve them.
 */
export async function getShopProducts(
  projectId: string,
  limit: number = DEFAULT_PRODUCTS_LIMIT,
): Promise<ShopProductsResult> {
  configureBitsnapBackend()

  const includeDrafts = isBitsnapApiKeyConfigured()

  return BitsnapBackend.getProducts(
    projectId,
    limit,
    0,
    { cache: 'no-store' },
    { groupVariants: true, includeDrafts },
  )
}
