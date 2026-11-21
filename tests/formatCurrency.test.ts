import { describe, expect, it } from 'vitest'

import { formatCurrency } from '../src/utils/formatCurrency.js'

describe('formatCurrency', () => {
  it('formats PLN minor units cleanly', () => {
    const formattedPl = formatCurrency(4999, 'PLN', 'pl-PL')
    expect(formattedPl).toContain('49,99')
    expect(formattedPl).toContain('zł')

    const formattedEn = formatCurrency(5000, 'PLN', 'en-US')
    expect(formattedEn).toContain('50')
    expect(formattedEn).toContain('zł')
  })

  it('formats non-PLN currencies dynamically', () => {
    const formattedEur = formatCurrency(1250, 'EUR', 'en-US')
    expect(formattedEur).toContain('12.50')
    expect(formattedEur).toContain('€')

    const formattedUsd = formatCurrency(1000, 'USD', 'en-US')
    expect(formattedUsd).toContain('10')
    expect(formattedUsd).toContain('$')
  })
})
