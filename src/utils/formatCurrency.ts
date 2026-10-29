/**
 * Formats a minor-unit amount (grosze/cents) as a currency string.
 *
 * Vendored from the consuming app so the package stays self-contained.
 */
export function formatCurrency(amount: number, currency: string, locale?: string): string {
  const resolvedLocale =
    locale ?? (typeof navigator !== 'undefined' ? navigator.language : 'pl')

  const formatter = new Intl.NumberFormat(resolvedLocale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  const result = formatter.format(amount / 100)

  const regex = new RegExp(`(\\.00)(?=\\D*$)`)

  if (currency.toLowerCase() === 'pln') {
    if (result.includes('zł')) {
      return result
    }
    return (result.replaceAll('PLN', '').trim() + ' zł').replace(regex, '')
  }

  return result.replace(regex, '')
}
