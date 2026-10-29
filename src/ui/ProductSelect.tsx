'use client'

import { FieldDescription, FieldLabel, useField } from '@payloadcms/ui'
import type { StaticDescription, UIFieldClientProps } from 'payload'
import type { BitsnapModels } from 'bitsnap-js/models'
import { type ChangeEvent, useEffect, useState } from 'react'

import type { BitsnapClientConfig } from '../types.js'
import { formatCurrency } from '../utils/formatCurrency.js'
import { getBitsnapClientConfig } from './getBitsnapClientConfig.js'

import './ProductSelect.css'

export type ProductSelectProps = UIFieldClientProps & Partial<BitsnapClientConfig>

type ShopProductsResponse = {
  data?: {
    success?: boolean
    result?: BitsnapModels.Item[]
  }
}

export const ProductSelect = (props: ProductSelectProps) => {
  const { apiBaseUrl, currency, dashboardUrl } = getBitsnapClientConfig(props)
  const { value = '', setValue } = useField<string>({ path: props.path })
  const [isPending, setIsPending] = useState(false)
  const [products, setProducts] = useState<BitsnapModels.Item[]>([])

  const orderedProducts = [
    ...products.filter((item) => item.isPublished !== false),
    ...products.filter((item) => item.isPublished === false),
  ]

  async function getProductsList() {
    setIsPending(true)
    try {
      const result = await fetch(`${apiBaseUrl}/shop-products`)

      const payload = (await result.json()) as ShopProductsResponse

      if (payload?.data?.success && Array.isArray(payload.data.result)) {
        setProducts(payload.data.result)
      } else {
        setProducts([])
      }
    } catch (e) {
      console.warn(e)
    } finally {
      setIsPending(false)
    }
  }

  function onChange(event: ChangeEvent<HTMLSelectElement>) {
    const nextID = event.target.value

    if (nextID === '') {
      return
    }

    const isDraft = products.some((item) => item.id === nextID && item.isPublished === false)

    if (isDraft) {
      return
    }

    setValue(nextID, false)
  }

  useEffect(() => {
    getProductsList().then().catch()
  }, [apiBaseUrl])

  function getProductImage(item: BitsnapModels.Item): string {
    if (item.images && item.images.length > 0) {
      return item.images[0]
    }
    return item.image_url
  }

  function getProductPrice(item: BitsnapModels.Item): string | null {
    if (!item.price) {
      return null
    }

    return formatCurrency(item.price, item.currency || currency)
  }

  const selectedProduct = products.find((item) => item.id === value)
  const selectedProductPrice = selectedProduct ? getProductPrice(selectedProduct) : null

  const rawDescription = props.field.admin?.description

  let description: StaticDescription | undefined

  if (typeof rawDescription === 'string') {
    description = rawDescription
  } else if (rawDescription !== null && typeof rawDescription === 'object') {
    description = Object.fromEntries(
      Object.entries(rawDescription).filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string',
      ),
    )
  }

  const selectID = `product-select${props.path.replace(/[^a-zA-Z0-9_-]/g, '-')}`

  return (
    <div className="product-select">
      <FieldLabel
        htmlFor={selectID}
        label={props.field.label}
        localized={props.field.localized}
        path={props.path}
        required={props.field.required}
      />
      <FieldDescription path={props.path} description={description} />

      {isPending && <div className="product-select-loading" />}

      {products.length > 0 && (
        <select
          className="product-select-trigger"
          id={selectID}
          onChange={onChange}
          value={value ?? ''}
        >
          <option value="">Wybierz produkt</option>
          {orderedProducts.map((item) => {
            const isDraft = item.isPublished === false
            const price = getProductPrice(item)

            return (
              <option disabled={isDraft} key={item.id} value={item.id}>
                {isDraft ? `${item.name} — Szkic` : item.name}
                {price ? ` — ${price}` : ''}
              </option>
            )
          })}
        </select>
      )}

      {selectedProduct && (
        <div className="product-select-summary">
          <img src={getProductImage(selectedProduct)} alt={selectedProduct.name} />
          <div className="product-select-summary-text">
            <span className="product-select-summary-name">{selectedProduct.name}</span>
            {selectedProductPrice && (
              <span className="product-select-summary-price">{selectedProductPrice}</span>
            )}
          </div>
        </div>
      )}

      {value != null && value != '' && value.startsWith('prodv2') && (
        <div>
          <a href={`${dashboardUrl}/app/product/${encodeURIComponent(value)}`}>Edytuj produkt</a>
        </div>
      )}
    </div>
  )
}
