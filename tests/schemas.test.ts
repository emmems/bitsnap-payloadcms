import { describe, expect, it } from 'vitest'

import {
  bitsnapListProductsQuerySchema,
  bitsnapUpdateSchema,
  createBitsnapCreateSchema,
} from '../src/server/schemas.js'

describe('createBitsnapCreateSchema', () => {
  it('uses per-instance default currency with zero global state', () => {
    const eurSchema = createBitsnapCreateSchema('EUR')
    const plnSchema = createBitsnapCreateSchema('PLN')

    const eurResult = eurSchema.parse({ name: 'Mug', priceAmount: 1999 })
    const plnResult = plnSchema.parse({ name: 'Kubek', priceAmount: 4999 })

    expect(eurResult.priceCurrency).toBe('EUR')
    expect(plnResult.priceCurrency).toBe('PLN')
  })

  it('validates images URLs and availableQuantity', () => {
    const schema = createBitsnapCreateSchema('PLN')

    const valid = schema.parse({
      name: 'Poster',
      priceAmount: 5000,
      availableQuantity: 25,
      images: ['https://cdn.example.com/a.jpg', 'https://cdn.example.com/b.png'],
    })

    expect(valid.availableQuantity).toBe(25)
    expect(valid.images).toHaveLength(2)

    const invalid = schema.safeParse({
      name: 'Poster',
      priceAmount: 5000,
      images: ['not-a-url'],
    })
    expect(invalid.success).toBe(false)
  })
})

describe('bitsnapUpdateSchema', () => {
  it('accepts partial updates with revision, images, and variants', () => {
    const parsed = bitsnapUpdateSchema.parse({
      revision: 3,
      status: 'PUBLISHED',
      priceAmount: 9900,
      priceCurrency: 'PLN',
      images: ['https://cdn.example.com/cover.webp'],
      variants: [{ id: 'var_1', name: 'L', priceAmount: 9900, availableQuantity: 5 }],
    })

    expect(parsed.revision).toBe(3)
    expect(parsed.images).toEqual(['https://cdn.example.com/cover.webp'])
    expect(parsed.variants).toHaveLength(1)
  })
})

describe('bitsnapListProductsQuerySchema', () => {
  it('applies defaults and parses query string params', () => {
    expect(bitsnapListProductsQuerySchema.parse({})).toEqual({
      search: undefined,
      cursor: undefined,
      limit: 50,
      includeDrafts: false,
    })

    expect(
      bitsnapListProductsQuerySchema.parse({
        search: '  hoodie  ',
        cursor: 'cur_2',
        limit: '25',
        includeDrafts: 'true',
      }),
    ).toEqual({
      search: 'hoodie',
      cursor: 'cur_2',
      limit: 25,
      includeDrafts: true,
    })
  })

  it('rejects out-of-range limits and invalid includeDrafts values', () => {
    expect(bitsnapListProductsQuerySchema.safeParse({ limit: '101' }).success).toBe(false)
    expect(bitsnapListProductsQuerySchema.safeParse({ limit: '0' }).success).toBe(false)
    expect(bitsnapListProductsQuerySchema.safeParse({ includeDrafts: 'maybe' }).success).toBe(
      false,
    )
  })
})
