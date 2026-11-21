import { z } from 'zod'

import { DEFAULT_CURRENCY, DEFAULT_PRODUCTS_LIMIT, MAX_PRODUCTS_LIMIT } from '../constants.js'

export const bitsnapStatusSchema = z.enum(['DRAFT', 'UNPUBLISHED', 'PUBLISHED'])

export const bitsnapVariantSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().min(1),
  priceAmount: z.number().int().nonnegative(),
  priceCurrency: z.string().min(1).optional(),
  availableQuantity: z.number().int().nonnegative().optional(),
})

/**
 * Builds a product creation schema whose default `priceCurrency` matches the
 * plugin instance configuration, with zero module-level mutable state.
 */
export function createBitsnapCreateSchema(defaultCurrency: string = DEFAULT_CURRENCY) {
  const normalizedCurrency =
    typeof defaultCurrency === 'string' && defaultCurrency.trim().length > 0
      ? defaultCurrency.trim()
      : DEFAULT_CURRENCY

  return z.object({
    name: z.string().min(1),
    priceAmount: z.number().int().nonnegative(),
    priceCurrency: z.string().min(1).default(normalizedCurrency),
    status: bitsnapStatusSchema.optional(),
    availableQuantity: z.number().int().nonnegative().optional(),
    images: z.array(z.string().url()).optional(),
    variants: z.array(bitsnapVariantSchema).optional(),
  })
}

export const bitsnapCreateSchema = createBitsnapCreateSchema()

export const bitsnapUpdateSchema = z.object({
  revision: z.number().int().optional(),
  name: z.string().min(1).optional(),
  priceAmount: z.number().int().nonnegative().optional(),
  priceCurrency: z.string().min(1).optional(),
  status: bitsnapStatusSchema.optional(),
  availableQuantity: z.number().int().nonnegative().optional(),
  images: z.array(z.string().url()).optional(),
  variants: z.array(bitsnapVariantSchema).optional(),
})

const booleanQueryParam = z
  .union([z.boolean(), z.string()])
  .optional()
  .transform((value, ctx) => {
    if (value === undefined || value === '') {
      return false
    }
    if (typeof value === 'boolean') {
      return value
    }
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true' || normalized === '1') {
      return true
    }
    if (normalized === 'false' || normalized === '0') {
      return false
    }
    ctx.addIssue({
      code: 'custom',
      message: 'Expected a boolean value ("true" or "false")',
    })
    return z.NEVER
  })

export const bitsnapListProductsQuerySchema = z.object({
  search: z
    .string()
    .optional()
    .transform((value) => {
      const trimmed = value?.trim()
      return trimmed && trimmed.length > 0 ? trimmed : undefined
    }),
  cursor: z
    .string()
    .optional()
    .transform((value) => {
      const trimmed = value?.trim()
      return trimmed && trimmed.length > 0 ? trimmed : undefined
    }),
  limit: z.coerce.number().int().min(1).max(MAX_PRODUCTS_LIMIT).default(DEFAULT_PRODUCTS_LIMIT),
  includeDrafts: booleanQueryParam,
})

export type BitsnapStatus = z.infer<typeof bitsnapStatusSchema>
export type BitsnapVariantInput = z.infer<typeof bitsnapVariantSchema>
export type BitsnapCreateInput = z.infer<typeof bitsnapCreateSchema>
export type BitsnapUpdateInput = z.infer<typeof bitsnapUpdateSchema>
export type BitsnapListProductsQuery = z.infer<typeof bitsnapListProductsQuerySchema>
