'use client'

import { Pill, useRowLabel } from '@payloadcms/ui'
import { useEffect, useState } from 'react'

import type { BitsnapClientConfig, ProductListItem } from '../types.js'
import { formatCurrency } from '../utils/formatCurrency.js'
import { useBitsnapClientConfig } from './getBitsnapClientConfig.js'
import { useBitsnapStrings } from './i18n.js'
import { fetchProductSummary, getCachedProductSummary } from './productCache.js'

type ProductRowData = {
  productID?: unknown
  bitsnapID?: unknown
}

export type BitsnapProductRowLabelProps = Partial<BitsnapClientConfig>

export const BitsnapProductRowLabel = (props?: BitsnapProductRowLabelProps) => {
  const { data, rowNumber } = useRowLabel<ProductRowData>()
  const { apiBaseUrl, currency } = useBitsnapClientConfig(props)
  const strings = useBitsnapStrings()

  const productId =
    typeof data?.productID === 'string' && data.productID.trim() !== ''
      ? data.productID.trim()
      : typeof data?.bitsnapID === 'string' && data.bitsnapID.trim() !== ''
        ? data.bitsnapID.trim()
        : ''

  const [summary, setSummary] = useState<ProductListItem | null>(() =>
    productId ? (getCachedProductSummary(productId) ?? null) : null,
  )
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!productId) {
      setSummary(null)
      setIsLoading(false)
      return
    }

    const cached = getCachedProductSummary(productId)
    if (cached) {
      setSummary(cached)
      setIsLoading(false)
      return
    }

    let cancelled = false
    setSummary(null)
    setIsLoading(true)

    void fetchProductSummary(apiBaseUrl, productId).then((fetched) => {
      if (!cancelled) {
        setSummary(fetched)
        setIsLoading(false)
      }
    })

    return () => {
      cancelled = true
    }
  }, [apiBaseUrl, productId])

  if (!productId) {
    return <span>{strings.rowLabel.empty(rowNumber !== undefined ? rowNumber + 1 : undefined)}</span>
  }

  if (!summary) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
        <span>{isLoading ? strings.rowLabel.loading : productId}</span>
      </span>
    )
  }

  const formattedPrice =
    summary.priceAmount !== null
      ? formatCurrency(summary.priceAmount, summary.priceCurrency ?? currency, strings.locale)
      : null

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        minWidth: 0,
        maxWidth: '100%',
      }}
    >
      {summary.imageUrl && (
        <img
          alt={summary.name}
          src={summary.imageUrl}
          style={{
            width: '22px',
            height: '22px',
            borderRadius: '3px',
            objectFit: 'cover',
            flexShrink: 0,
          }}
        />
      )}
      <span
        style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontWeight: 500,
        }}
      >
        {summary.name}
      </span>
      {formattedPrice && (
        <span
          style={{
            color: 'var(--theme-elevation-500, #9a9a9a)',
            fontVariantNumeric: 'tabular-nums',
            flexShrink: 0,
          }}
        >
          {formattedPrice}
        </span>
      )}
      {summary.status !== 'PUBLISHED' && (
        <Pill size="small">{strings.status[summary.status]}</Pill>
      )}
    </span>
  )
}
