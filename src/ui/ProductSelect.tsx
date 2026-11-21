'use client'

import {
  Banner,
  Button,
  FieldDescription,
  FieldLabel,
  ReactSelect,
  type ReactSelectOption,
  useField,
} from '@payloadcms/ui'
import type { StaticDescription, TextFieldClientProps } from 'payload'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { DEFAULT_PRODUCTS_LIMIT } from '../constants.js'
import type { BitsnapClientConfig, ProductListItem } from '../types.js'
import { formatCurrency } from '../utils/formatCurrency.js'
import { useBitsnapClientConfig } from './getBitsnapClientConfig.js'
import { type BitsnapStrings, useBitsnapStrings } from './i18n.js'
import {
  fetchProductsPage,
  fetchProductSummary,
  getCachedProductSummary,
} from './productCache.js'

import './ProductSelect.css'

export type ProductSelectProps = TextFieldClientProps & Partial<BitsnapClientConfig>

type ProductOption = ReactSelectOption<string> & {
  label: string
  value: string
  product: ProductListItem
  isDisabled?: boolean
}

type CustomOptionProps = {
  data: ProductOption
  innerProps: React.HTMLAttributes<HTMLDivElement>
  innerRef: React.Ref<HTMLDivElement>
  isDisabled?: boolean
  isFocused?: boolean
  isSelected?: boolean
}

type CustomSingleValueProps = {
  data: ProductOption
  innerProps?: React.HTMLAttributes<HTMLDivElement>
}

const SEARCH_DEBOUNCE_MS = 300

function formatItemPrice(
  item: ProductListItem,
  fallbackCurrency: string,
  locale: string,
): string | null {
  if (item.priceAmount === null) {
    return null
  }
  return formatCurrency(item.priceAmount, item.priceCurrency ?? fallbackCurrency, locale)
}

function createOptionComponent(currency: string, strings: BitsnapStrings) {
  return function ProductOptionComponent(props: CustomOptionProps) {
    const { data, innerProps, innerRef, isDisabled, isFocused, isSelected } = props
    const product = data.product
    const price = formatItemPrice(product, currency, strings.locale)

    return (
      <div
        {...innerProps}
        className="product-select-item"
        data-disabled={isDisabled ? 'true' : undefined}
        data-focused={isFocused ? 'true' : undefined}
        data-selected={isSelected ? 'true' : undefined}
        ref={innerRef}
      >
        <div className="product-select-item-content">
          {product.imageUrl ? (
            <img
              alt={product.name}
              className="product-select-item-thumb"
              height={28}
              src={product.imageUrl}
              width={28}
            />
          ) : (
            <span aria-hidden="true" className="product-select-item-thumb-placeholder" />
          )}
          <span className="product-select-item-name">{product.name}</span>
        </div>
        {product.status !== 'PUBLISHED' && (
          <span className="product-select-item-status">{strings.status[product.status]}</span>
        )}
        {price && <span className="product-select-item-price">{price}</span>}
      </div>
    )
  }
}

function createSingleValueComponent(currency: string, strings: BitsnapStrings) {
  return function ProductSingleValueComponent(props: CustomSingleValueProps) {
    const { data, innerProps } = props
    const product = data.product
    const price = formatItemPrice(product, currency, strings.locale)

    return (
      <div {...innerProps} className="product-select-single-value">
        {product.imageUrl && (
          <img
            alt={product.name}
            className="product-select-item-thumb"
            height={20}
            src={product.imageUrl}
            width={20}
          />
        )}
        <span className="product-select-item-name">{product.name}</span>
        {product.status !== 'PUBLISHED' && (
          <span className="product-select-item-status">{strings.status[product.status]}</span>
        )}
        {price && <span className="product-select-item-price">{price}</span>}
      </div>
    )
  }
}

export const ProductSelect = (props: ProductSelectProps) => {
  const { apiBaseUrl, currency, host } = useBitsnapClientConfig(props)
  const strings = useBitsnapStrings()
  const { value = '', setValue } = useField<string>({ path: props.path })

  const allowDrafts = props.field.admin?.custom?.allowDrafts === true

  const [products, setProducts] = useState<ProductListItem[]>([])
  const [nextCursor, setNextCursor] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [hydratedProduct, setHydratedProduct] = useState<ProductListItem | null>(() =>
    value ? (getCachedProductSummary(value) ?? null) : null,
  )

  const requestSeqRef = useRef(0)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim())
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
    }
  }, [searchInput])

  const loadPage = useCallback(
    async (search: string, cursor: string, append: boolean) => {
      const seq = ++requestSeqRef.current
      if (append) {
        setIsLoadingMore(true)
      } else {
        setIsLoading(true)
      }
      setErrorMessage(null)

      try {
        const result = await fetchProductsPage(apiBaseUrl, {
          search: search || undefined,
          cursor: cursor || undefined,
          limit: DEFAULT_PRODUCTS_LIMIT,
          includeDrafts: true,
        })

        if (seq !== requestSeqRef.current) {
          return
        }

        setProducts((prev) => {
          if (!append) {
            return result.products
          }
          const seen = new Set(prev.map((item) => item.id))
          const merged = [...prev]
          for (const item of result.products) {
            if (!seen.has(item.id)) {
              merged.push(item)
            }
          }
          return merged
        })
        setNextCursor(result.nextCursor)
      } catch (error) {
        if (seq !== requestSeqRef.current) {
          return
        }
        setErrorMessage(error instanceof Error ? error.message : strings.productSelect.loadError)
      } finally {
        if (seq === requestSeqRef.current) {
          setIsLoading(false)
          setIsLoadingMore(false)
        }
      }
    },
    [apiBaseUrl, strings.productSelect.loadError],
  )

  useEffect(() => {
    void loadPage(debouncedSearch, '', false)
  }, [debouncedSearch, loadPage])

  useEffect(() => {
    if (!value) {
      setHydratedProduct(null)
      return
    }

    const inList = products.find((item) => item.id === value)
    if (inList) {
      setHydratedProduct(inList)
      return
    }

    const cached = getCachedProductSummary(value)
    if (cached) {
      setHydratedProduct(cached)
      return
    }

    setHydratedProduct(null)
    let cancelled = false
    void fetchProductSummary(apiBaseUrl, value).then((summary) => {
      if (!cancelled) {
        setHydratedProduct(summary)
      }
    })

    return () => {
      cancelled = true
    }
  }, [apiBaseUrl, products, value])

  const orderedProducts = useMemo(() => {
    const published = products.filter((item) => item.status === 'PUBLISHED')
    const nonPublished = products.filter((item) => item.status !== 'PUBLISHED')
    return [...published, ...nonPublished]
  }, [products])

  const options = useMemo<ProductOption[]>(
    () =>
      orderedProducts.map((product) => ({
        label: product.name,
        value: product.id,
        product,
        isDisabled: !allowDrafts && product.status !== 'PUBLISHED',
      })),
    [allowDrafts, orderedProducts],
  )

  const selectedProduct = useMemo(() => {
    if (!value) {
      return null
    }
    return (
      products.find((item) => item.id === value) ??
      (hydratedProduct?.id === value ? hydratedProduct : null)
    )
  }, [hydratedProduct, products, value])

  const selectedOption = useMemo<ProductOption | null>(() => {
    if (!value) {
      return null
    }
    const existing = options.find((opt) => opt.value === value)
    if (existing) {
      return existing
    }
    if (selectedProduct) {
      return {
        label: selectedProduct.name,
        value: selectedProduct.id,
        product: selectedProduct,
      }
    }
    return {
      label: value,
      value,
      product: {
        id: value,
        name: value,
        status: 'PUBLISHED',
        priceAmount: null,
        priceCurrency: null,
        imageUrl: null,
        variantsCount: 0,
      },
    }
  }, [options, selectedProduct, value])

  const customComponents = useMemo(
    () => ({
      Option: createOptionComponent(currency, strings),
      SingleValue: createSingleValueComponent(currency, strings),
    }),
    [currency, strings],
  )

  const handleChange = (selected: ReactSelectOption | ReactSelectOption[] | null) => {
    if (!selected) {
      setValue('', false)
      return
    }

    const next = Array.isArray(selected) ? selected[0] : selected
    if (!next || typeof next.value !== 'string') {
      setValue('', false)
      return
    }

    const option = next as ProductOption
    if (!allowDrafts && option.product && option.product.status !== 'PUBLISHED') {
      return
    }

    setValue(option.value, false)
  }

  const handleScrollToBottom = () => {
    if (nextCursor && !isLoading && !isLoadingMore) {
      void loadPage(debouncedSearch, nextCursor, true)
    }
  }

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

  const selectID = `product-select-${props.path.replace(/[^a-zA-Z0-9_-]/g, '-')}`
  const selectedPrice = selectedProduct
    ? formatItemPrice(selectedProduct, currency, strings.locale)
    : null

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

      {errorMessage && (
        <div className="product-select-error">
          <Banner type="error">
            <span>{errorMessage}</span>
            <Button
              buttonStyle="subtle"
              onClick={() => {
                void loadPage(debouncedSearch, '', false)
              }}
              size="small"
            >
              {strings.productSelect.retry}
            </Button>
          </Banner>
        </div>
      )}

      <div className="product-select-control">
        <ReactSelect
          components={customComponents}
          disabled={props.readOnly}
          filterOption={() => true}
          inputId={selectID}
          isClearable
          isLoading={isLoading || isLoadingMore}
          isSearchable
          noOptionsMessage={({ inputValue }) =>
            isLoading
              ? strings.productSelect.loading
              : inputValue.trim()
                ? strings.productSelect.noResults(inputValue.trim())
                : strings.productSelect.noOptions
          }
          onChange={handleChange}
          onInputChange={(val) => setSearchInput(val)}
          onMenuScrollToBottom={handleScrollToBottom}
          options={options}
          placeholder={strings.productSelect.placeholder}
          value={selectedOption ?? (null as unknown as ReactSelectOption)}
        />
      </div>

      {selectedProduct && (
        <div className="product-select-summary">
          {selectedProduct.imageUrl && (
            <img alt={selectedProduct.name} src={selectedProduct.imageUrl} />
          )}
          <div className="product-select-summary-text">
            <span className="product-select-summary-name">{selectedProduct.name}</span>
            <div className="product-select-summary-meta">
              {selectedPrice && <span className="product-select-summary-price">{selectedPrice}</span>}
              {selectedProduct.status !== 'PUBLISHED' && (
                <span className="product-select-item-status">
                  {strings.status[selectedProduct.status]}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {typeof value === 'string' && value.trim() !== '' && (
        <div className="product-select-link">
          <a
            href={`${host}/app/product/${encodeURIComponent(value.trim())}`}
            rel="noreferrer noopener"
            target="_blank"
          >
            {strings.productSelect.editProduct}
          </a>
        </div>
      )}
    </div>
  )
}
