import type {
  CreateProductRequest,
  Environment,
  GetAccountResponse,
  Product,
  ProductStatus,
  UpdateProductRequest,
  Variant,
  VariantInput,
} from 'bitsnap-js/client'

import { DEFAULT_CURRENCY } from '../constants.js'
import type {
  BitsnapAccountInfo,
  BitsnapEnvironment,
  BitsnapStatus,
  ManagedProduct,
  ManagedVariant,
  ProductListItem,
} from '../types.js'
import type { BitsnapCreateInput, BitsnapUpdateInput, BitsnapVariantInput } from './schemas.js'

export function toBitsnapStatus(status: ProductStatus): BitsnapStatus {
  switch (status) {
    case 'PRODUCT_STATUS_PUBLISHED':
      return 'PUBLISHED'
    case 'PRODUCT_STATUS_UNPUBLISHED':
      return 'UNPUBLISHED'
    case 'PRODUCT_STATUS_DRAFT':
    case 'PRODUCT_STATUS_UNSPECIFIED':
    default:
      return 'DRAFT'
  }
}

export function toApiProductStatus(status: BitsnapStatus): ProductStatus {
  switch (status) {
    case 'PUBLISHED':
      return 'PRODUCT_STATUS_PUBLISHED'
    case 'UNPUBLISHED':
      return 'PRODUCT_STATUS_UNPUBLISHED'
    case 'DRAFT':
      return 'PRODUCT_STATUS_DRAFT'
  }
}

export function toAccountEnvironment(environment: Environment): BitsnapEnvironment {
  switch (environment) {
    case 'ENVIRONMENT_LIVE':
      return 'live'
    case 'ENVIRONMENT_TEST':
      return 'test'
    default:
      return 'unknown'
  }
}

export function mapAccountInfo(response: GetAccountResponse): BitsnapAccountInfo {
  return {
    projectId: response.projectId,
    projectName: response.projectName,
    environment: toAccountEnvironment(response.environment),
    canWrite: response.canWrite,
    scopes: Array.isArray(response.scopes) ? response.scopes : [],
  }
}

export function mapManagedVariant(variant: Variant): ManagedVariant {
  return {
    id: variant.id,
    name: variant.name,
    priceAmount: variant.price?.amount ?? null,
    priceCurrency: variant.price?.currency ?? null,
    availableQuantity: variant.availableQuantity ?? null,
  }
}

export function mapManagedProduct(product: Product): ManagedProduct {
  return {
    id: product.id,
    name: product.name,
    status: toBitsnapStatus(product.status),
    priceAmount: product.price?.amount ?? null,
    priceCurrency: product.price?.currency ?? null,
    availableQuantity: product.availableQuantity ?? null,
    images: Array.isArray(product.images) ? product.images : [],
    variants: Array.isArray(product.variants) ? product.variants.map(mapManagedVariant) : [],
    revision: product.revision,
  }
}

export function mapProductListItem(product: Product): ProductListItem {
  const images = Array.isArray(product.images) ? product.images : []
  const variants = Array.isArray(product.variants) ? product.variants : []

  return {
    id: product.id,
    name: product.name,
    status: toBitsnapStatus(product.status),
    priceAmount: product.price?.amount ?? null,
    priceCurrency: product.price?.currency ?? null,
    imageUrl: images[0] ?? null,
    variantsCount: variants.length,
  }
}

export function mapVariantInput(
  variant: BitsnapVariantInput,
  fallbackCurrency?: string,
): VariantInput {
  const currency = variant.priceCurrency ?? fallbackCurrency

  return {
    ...(variant.id ? { id: variant.id } : {}),
    name: variant.name,
    price: {
      amount: variant.priceAmount,
      ...(currency ? { currency } : {}),
    },
    ...(variant.availableQuantity !== undefined
      ? { availableQuantity: variant.availableQuantity }
      : {}),
  }
}

export function mapCreateProductRequest(input: BitsnapCreateInput): CreateProductRequest {
  return {
    name: input.name,
    price: {
      amount: input.priceAmount,
      currency: input.priceCurrency,
    },
    ...(input.status ? { status: toApiProductStatus(input.status) } : {}),
    ...(input.availableQuantity !== undefined
      ? { availableQuantity: input.availableQuantity }
      : {}),
    ...(input.images !== undefined ? { images: input.images } : {}),
    ...(input.variants !== undefined
      ? { variants: input.variants.map((v) => mapVariantInput(v, input.priceCurrency)) }
      : {}),
  }
}

export function mapUpdateProductRequest(
  id: string,
  patch: BitsnapUpdateInput,
  fallbackCurrency: string = DEFAULT_CURRENCY,
): UpdateProductRequest {
  const priceCurrency = patch.priceCurrency ?? fallbackCurrency

  return {
    id,
    ...(patch.revision !== undefined ? { revision: patch.revision } : {}),
    ...(patch.name !== undefined ? { name: patch.name } : {}),
    ...(patch.priceAmount !== undefined
      ? { price: { amount: patch.priceAmount, currency: priceCurrency } }
      : {}),
    ...(patch.status !== undefined ? { status: toApiProductStatus(patch.status) } : {}),
    ...(patch.availableQuantity !== undefined
      ? { availableQuantity: patch.availableQuantity }
      : {}),
    ...(patch.images !== undefined ? { images: patch.images } : {}),
    ...(patch.variants !== undefined
      ? { variants: patch.variants.map((v) => mapVariantInput(v, priceCurrency)) }
      : {}),
  }
}
