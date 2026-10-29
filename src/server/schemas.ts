import { z } from 'zod'

import { DEFAULT_CURRENCY } from '../constants.js'

/**
 * Currency used when the request body omits `priceCurrency`.
 *
 * The plugin sets it from its own configuration during initialization, so the
 * default follows the project instead of being hardcoded.
 */
let currentCurrency: string = DEFAULT_CURRENCY

export function setBitsnapCurrency(currency: string): void {
  if (typeof currency === 'string' && currency.length > 0) {
    currentCurrency = currency
  }
}

export function getBitsnapCurrency(): string {
  return currentCurrency
}

export const bitsnapStatusSchema = z.enum(['DRAFT', 'UNPUBLISHED', 'PUBLISHED'])

export const bitsnapVariantSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  priceAmount: z.number().int().nonnegative(),
  priceCurrency: z.string().min(1).optional(),
  availableQuantity: z.number().int().nonnegative().optional(),
})

export const bitsnapCreateSchema = z.object({
  name: z.string().min(1),
  priceAmount: z.number().int().nonnegative(),
  priceCurrency: z.string().min(1).default(() => getBitsnapCurrency()),
  status: bitsnapStatusSchema.optional(),
  availableQuantity: z.number().int().nonnegative().optional(),
  variants: z.array(bitsnapVariantSchema).optional(),
})

export const bitsnapUpdateSchema = z.object({
  revision: z.number().int().optional(),
  name: z.string().min(1).optional(),
  priceAmount: z.number().int().nonnegative().optional(),
  status: bitsnapStatusSchema.optional(),
  availableQuantity: z.number().int().nonnegative().optional(),
  variants: z.array(bitsnapVariantSchema).optional(),
})

export type BitsnapStatus = z.infer<typeof bitsnapStatusSchema>
export type BitsnapVariantInput = z.infer<typeof bitsnapVariantSchema>
export type BitsnapCreateInput = z.infer<typeof bitsnapCreateSchema>
export type BitsnapUpdateInput = z.infer<typeof bitsnapUpdateSchema>
