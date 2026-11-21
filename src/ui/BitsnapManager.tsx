'use client'

import {
  Banner,
  Button,
  CopyToClipboard,
  FieldDescription,
  FieldLabel,
  Pill,
  ReactSelect,
  type ReactSelectOption,
  SelectInput,
  TextareaInput,
  TextInput,
  toast,
  useForm,
  useFormFields,
  useTranslation,
} from '@payloadcms/ui'
import type { UIFieldClientProps } from 'payload'
import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { DEFAULT_PRODUCT_ID_PATH, DEFAULT_PRODUCTS_LIMIT } from '../constants.js'
import type {
  BitsnapAccountInfo,
  BitsnapClientConfig,
  BitsnapStatus,
  ManagedProduct,
  ProductListItem,
} from '../types.js'
import { formatCurrency } from '../utils/formatCurrency.js'
import { useBitsnapClientConfig } from './getBitsnapClientConfig.js'
import { useBitsnapStrings } from './i18n.js'
import {
  fetchProductsPage,
  invalidateProductsCache,
  primeProductSummary,
} from './productCache.js'

import './BitsnapManager.css'

export type BitsnapManagerProps = UIFieldClientProps & Partial<BitsnapClientConfig>

type VariantRow = {
  id?: string
  name: string
  price: string
  stock: string
}

type Message = {
  tone: 'success' | 'error' | 'info'
  text: string
}

type UnlinkedMode = 'create' | 'link'

type LinkOption = ReactSelectOption<string> & {
  label: string
  value: string
  product: ProductListItem
}

const minorUnitsToDecimal = (amount: number | null): string =>
  amount === null ? '' : (amount / 100).toFixed(2).replace('.', ',')

const parsePrice = (value: string): number | null | undefined => {
  const trimmed = value.trim()
  if (trimmed === '') return undefined
  const normalized = trimmed.replace(/\s/g, '').replace(',', '.')
  const parsed = Number.parseFloat(normalized)
  if (!Number.isFinite(parsed) || parsed < 0) return null
  return Math.round(parsed * 100)
}

const parseQuantity = (value: string): number | null | undefined => {
  const trimmed = value.trim()
  if (trimmed === '') return undefined
  const parsed = Number(trimmed)
  if (!Number.isInteger(parsed) || parsed < 0) return null
  return parsed
}

const parseImageUrls = (value: string): string[] | null | undefined => {
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  if (lines.length === 0) {
    return undefined
  }

  for (const line of lines) {
    try {
      const parsed = new URL(line)
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return null
      }
    } catch {
      return null
    }
  }

  return lines
}

const resolveLocalizedText = (value: unknown, language?: string): string | undefined => {
  if (typeof value === 'string') {
    return value
  }
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>
    const normalizedLang = language?.toLowerCase()
    const baseLang = normalizedLang?.split('-')[0]
    const candidates = [language, normalizedLang, baseLang, 'en', 'pl'].filter(
      (key): key is string => Boolean(key),
    )
    for (const key of candidates) {
      const candidate = record[key]
      if (typeof candidate === 'string') {
        return candidate
      }
    }
    for (const candidate of Object.values(record)) {
      if (typeof candidate === 'string') {
        return candidate
      }
    }
  }
  return undefined
}

export const BitsnapManager = (props: BitsnapManagerProps) => {
  const { dispatchFields } = useForm()
  const { apiBaseUrl, currency, host } = useBitsnapClientConfig(props)
  const { i18n } = useTranslation()
  const strings = useBitsnapStrings()

  const custom = props.field.admin?.custom
  const targetPath =
    typeof custom?.productIdPath === 'string' && custom.productIdPath.trim() !== ''
      ? custom.productIdPath.trim()
      : DEFAULT_PRODUCT_ID_PATH

  const title =
    resolveLocalizedText(props.field.label, i18n?.language) ?? strings.manager.defaultTitle
  const description = resolveLocalizedText(props.field.admin?.description, i18n?.language)

  const linkedProductID = useFormFields(([fields]) => {
    const value = fields[targetPath]?.value
    return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
  })

  const productTitle = useFormFields(([fields]) => {
    const value = fields.title?.value
    return typeof value === 'string' ? value : ''
  })

  // Account status strip
  const [account, setAccount] = useState<BitsnapAccountInfo | null>(null)

  // Linked product edit state
  const [status, setStatus] = useState<BitsnapStatus>('DRAFT')
  const [price, setPrice] = useState('')
  const [productCurrency, setProductCurrency] = useState<string | null>(null)
  const [stock, setStock] = useState('')
  const [variants, setVariants] = useState<VariantRow[]>([])
  const [confirmDeleteIndex, setConfirmDeleteIndex] = useState<number | null>(null)
  const [revision, setRevision] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<Message | null>(null)
  const [needsDocSaveReminder, setNeedsDocSaveReminder] = useState(false)

  // Unlinked create-or-link state
  const [unlinkedMode, setUnlinkedMode] = useState<UnlinkedMode>('create')
  const [newName, setNewName] = useState<string | null>(null)
  const [newPrice, setNewPrice] = useState('')
  const [newStatus, setNewStatus] = useState<BitsnapStatus>('DRAFT')
  const [newStock, setNewStock] = useState('')
  const [newImages, setNewImages] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  // Embedded picker state for "Link existing"
  const [linkProducts, setLinkProducts] = useState<ProductListItem[]>([])
  const [linkNextCursor, setLinkNextCursor] = useState('')
  const [linkSearchInput, setLinkSearchInput] = useState('')
  const [linkDebouncedSearch, setLinkDebouncedSearch] = useState('')
  const [isLinkLoading, setIsLinkLoading] = useState(false)

  const lastLoadedIdRef = useRef<string | null>(null)
  const loadRequestSeqRef = useRef(0)
  const linkRequestSeqRef = useRef(0)

  const activeCurrency = productCurrency || currency
  const canWrite = account ? account.canWrite : true

  useEffect(() => {
    let cancelled = false

    fetch(`${apiBaseUrl}/account`)
      .then(async (response) => {
        if (!response.ok) return
        const payload = (await response.json().catch(() => null)) as BitsnapAccountInfo | null
        if (!cancelled && payload && typeof payload.projectId === 'string') {
          setAccount(payload)
        }
      })
      .catch(() => {
        // Account metadata is advisory — do not block the manager UI if unavailable.
      })

    return () => {
      cancelled = true
    }
  }, [apiBaseUrl])

  const applyProduct = useCallback((product: ManagedProduct) => {
    setStatus(product.status)
    setPrice(minorUnitsToDecimal(product.priceAmount))
    setProductCurrency(product.priceCurrency)
    setStock(product.availableQuantity === null ? '' : String(product.availableQuantity))
    setRevision(product.revision)
    setConfirmDeleteIndex(null)
    setVariants(
      product.variants.map((variant) => ({
        id: variant.id,
        name: variant.name,
        price: minorUnitsToDecimal(variant.priceAmount),
        stock: variant.availableQuantity === null ? '' : String(variant.availableQuantity),
      })),
    )
    primeProductSummary(product)
  }, [])

  const load = useCallback(
    async (options?: { preserveMessage?: boolean }): Promise<boolean> => {
      if (!linkedProductID) {
        loadRequestSeqRef.current += 1
        lastLoadedIdRef.current = null
        setRevision(null)
        setVariants([])
        setProductCurrency(null)
        setIsLoading(false)
        return false
      }

      const seq = ++loadRequestSeqRef.current
      setIsLoading(true)
      if (!options?.preserveMessage) {
        setMessage(null)
      }

      try {
        const response = await fetch(
          `${apiBaseUrl}/products/${encodeURIComponent(linkedProductID)}`,
        )
        const payload = (await response.json().catch(() => ({}))) as {
          product?: ManagedProduct
          error?: string
        }

        if (seq !== loadRequestSeqRef.current) {
          return false
        }

        if (!response.ok || !payload.product) {
          throw new Error(payload.error ?? strings.manager.errors.loadFailed)
        }

        lastLoadedIdRef.current = payload.product.id
        applyProduct(payload.product)
        return true
      } catch (error) {
        if (seq !== loadRequestSeqRef.current) {
          return false
        }
        setMessage({
          tone: 'error',
          text: error instanceof Error ? error.message : strings.manager.errors.loadFailed,
        })
        return false
      } finally {
        if (seq === loadRequestSeqRef.current) {
          setIsLoading(false)
        }
      }
    },
    [apiBaseUrl, applyProduct, linkedProductID, strings.manager.errors.loadFailed],
  )

  useEffect(() => {
    if (!linkedProductID) {
      loadRequestSeqRef.current += 1
      lastLoadedIdRef.current = null
      setRevision(null)
      setVariants([])
      setProductCurrency(null)
      setIsLoading(false)
      return
    }

    if (lastLoadedIdRef.current === linkedProductID) {
      return
    }

    void load()
  }, [linkedProductID, load])

  // Debounced search for embedded "Link existing" picker
  useEffect(() => {
    const timer = setTimeout(() => {
      setLinkDebouncedSearch(linkSearchInput.trim())
    }, 300)
    return () => clearTimeout(timer)
  }, [linkSearchInput])

  const loadLinkProducts = useCallback(
    async (search: string, cursor: string, append: boolean) => {
      const seq = ++linkRequestSeqRef.current
      setIsLinkLoading(true)
      try {
        const result = await fetchProductsPage(apiBaseUrl, {
          search: search || undefined,
          cursor: cursor || undefined,
          limit: DEFAULT_PRODUCTS_LIMIT,
          includeDrafts: true,
        })
        if (seq !== linkRequestSeqRef.current) return
        setLinkProducts((prev) => {
          if (!append) return result.products
          const seen = new Set(prev.map((item) => item.id))
          return [...prev, ...result.products.filter((item) => !seen.has(item.id))]
        })
        setLinkNextCursor(result.nextCursor)
      } catch {
        // Picker error handled silently in empty state
      } finally {
        if (seq === linkRequestSeqRef.current) {
          setIsLinkLoading(false)
        }
      }
    },
    [apiBaseUrl],
  )

  useEffect(() => {
    if (!linkedProductID && unlinkedMode === 'link') {
      void loadLinkProducts(linkDebouncedSearch, '', false)
    }
  }, [linkDebouncedSearch, linkedProductID, loadLinkProducts, unlinkedMode])

  const save = useCallback(async () => {
    if (!linkedProductID || revision === null || !canWrite) return

    const priceAmount = parsePrice(price)
    const availableQuantity = parseQuantity(stock)

    if (priceAmount === null) {
      setMessage({ tone: 'error', text: strings.manager.errors.invalidBasePrice })
      return
    }

    if (availableQuantity === null) {
      setMessage({ tone: 'error', text: strings.manager.errors.invalidStock })
      return
    }

    const payloadVariants: {
      id?: string
      name: string
      priceAmount: number
      priceCurrency: string
      availableQuantity?: number
    }[] = []

    for (const variant of variants) {
      const name = variant.name.trim()
      const variantPrice = parsePrice(variant.price)
      const variantStock = parseQuantity(variant.stock)

      if (name === '') {
        setMessage({ tone: 'error', text: strings.manager.errors.variantNameRequired })
        return
      }

      if (variantPrice === null || variantPrice === undefined) {
        setMessage({ tone: 'error', text: strings.manager.errors.variantPriceRequired(name) })
        return
      }

      if (variantStock === null) {
        setMessage({ tone: 'error', text: strings.manager.errors.variantStockInvalid(name) })
        return
      }

      payloadVariants.push({
        ...(variant.id ? { id: variant.id } : {}),
        name,
        priceAmount: variantPrice,
        priceCurrency: activeCurrency,
        ...(variantStock === undefined ? {} : { availableQuantity: variantStock }),
      })
    }

    setIsSaving(true)
    setMessage(null)

    try {
      const response = await fetch(
        `${apiBaseUrl}/products/${encodeURIComponent(linkedProductID)}`,
        {
          body: JSON.stringify({
            revision,
            status,
            ...(priceAmount === undefined ? {} : { priceAmount, priceCurrency: activeCurrency }),
            ...(availableQuantity === undefined ? {} : { availableQuantity }),
            variants: payloadVariants,
          }),
          headers: { 'Content-Type': 'application/json' },
          method: 'PATCH',
        },
      )

      const payload = (await response.json().catch(() => ({}))) as {
        product?: ManagedProduct
        error?: string
      }

      if (!response.ok) {
        if (response.status === 409) {
          setMessage({ tone: 'error', text: strings.manager.errors.conflict })
          return
        }

        throw new Error(payload.error ?? strings.manager.errors.saveFailed)
      }

      invalidateProductsCache()

      if (payload.product) {
        loadRequestSeqRef.current += 1
        lastLoadedIdRef.current = payload.product.id
        applyProduct(payload.product)
      } else {
        await load({ preserveMessage: true })
      }

      setMessage({ tone: 'success', text: strings.manager.success.saved })
      toast.success(strings.manager.success.saved)
    } catch (error) {
      setMessage({
        tone: 'error',
        text: error instanceof Error ? error.message : strings.manager.errors.saveFailed,
      })
    } finally {
      setIsSaving(false)
    }
  }, [
    activeCurrency,
    apiBaseUrl,
    applyProduct,
    canWrite,
    linkedProductID,
    load,
    price,
    revision,
    status,
    stock,
    strings.manager.errors,
    strings.manager.success.saved,
    variants,
  ])

  const create = useCallback(async () => {
    if (!canWrite) return

    const name = (newName ?? productTitle).trim()
    const priceAmount = parsePrice(newPrice)
    const availableQuantity = parseQuantity(newStock)
    const images = parseImageUrls(newImages)

    if (name === '') {
      setMessage({ tone: 'error', text: strings.manager.errors.productNameRequired })
      return
    }

    if (priceAmount === null || priceAmount === undefined) {
      setMessage({ tone: 'error', text: strings.manager.errors.productPriceRequired(currency) })
      return
    }

    if (availableQuantity === null) {
      setMessage({ tone: 'error', text: strings.manager.errors.invalidStock })
      return
    }

    if (images === null) {
      setMessage({ tone: 'error', text: strings.manager.errors.invalidImages })
      return
    }

    setIsCreating(true)
    setMessage(null)

    try {
      const response = await fetch(`${apiBaseUrl}/products`, {
        body: JSON.stringify({
          name,
          priceAmount,
          priceCurrency: currency,
          status: newStatus,
          ...(availableQuantity === undefined ? {} : { availableQuantity }),
          ...(images === undefined ? {} : { images }),
        }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      })

      const payload = (await response.json().catch(() => ({}))) as {
        id?: string
        product?: ManagedProduct
        error?: string
      }

      const createdId = payload.product?.id ?? payload.id
      if (!response.ok || !createdId) {
        throw new Error(payload.error ?? strings.manager.errors.createFailed)
      }

      invalidateProductsCache()

      if (payload.product) {
        loadRequestSeqRef.current += 1
        lastLoadedIdRef.current = payload.product.id
        applyProduct(payload.product)
      }

      dispatchFields({ path: targetPath, type: 'UPDATE', value: createdId })
      setNeedsDocSaveReminder(true)

      const successText = strings.manager.success.created(createdId)
      setMessage({ tone: 'success', text: successText })
      toast.success(successText)
    } catch (error) {
      setMessage({
        tone: 'error',
        text: error instanceof Error ? error.message : strings.manager.errors.createFailed,
      })
    } finally {
      setIsCreating(false)
    }
  }, [
    apiBaseUrl,
    applyProduct,
    canWrite,
    currency,
    dispatchFields,
    newImages,
    newName,
    newPrice,
    newStatus,
    newStock,
    productTitle,
    strings.manager.errors,
    strings.manager.success,
    targetPath,
  ])

  const handleLinkExisting = (selected: ReactSelectOption | ReactSelectOption[] | null) => {
    if (!selected) return
    const next = Array.isArray(selected) ? selected[0] : selected
    if (!next || typeof next.value !== 'string') return

    const option = next as LinkOption
    dispatchFields({ path: targetPath, type: 'UPDATE', value: option.value })
    setNeedsDocSaveReminder(true)
    const successText = strings.manager.success.linked(option.product?.name ?? option.value)
    setMessage({ tone: 'success', text: successText })
    toast.success(successText)
  }

  const handleUnlink = () => {
    loadRequestSeqRef.current += 1
    lastLoadedIdRef.current = null
    setIsLoading(false)
    dispatchFields({ path: targetPath, type: 'UPDATE', value: '' })
    setRevision(null)
    setVariants([])
    setProductCurrency(null)
    setConfirmDeleteIndex(null)
    setNeedsDocSaveReminder(false)
    setMessage({ tone: 'info', text: strings.manager.unlinkedNotice })
  }

  const updateVariant = (index: number, patch: Partial<VariantRow>) => {
    setVariants((current) =>
      current.map((variant, variantIndex) =>
        variantIndex === index ? { ...variant, ...patch } : variant,
      ),
    )
  }

  const removeVariant = (index: number) => {
    setVariants((current) => current.filter((_, i) => i !== index))
    setConfirmDeleteIndex(null)
  }

  const statusOptions = useMemo(
    () =>
      (['DRAFT', 'UNPUBLISHED', 'PUBLISHED'] as BitsnapStatus[]).map((option) => ({
        label: strings.status[option],
        value: option,
      })),
    [strings.status],
  )

  const linkOptions = useMemo<LinkOption[]>(
    () =>
      linkProducts.map((product) => {
        const formattedPrice =
          product.priceAmount !== null
            ? ` — ${formatCurrency(product.priceAmount, product.priceCurrency ?? currency, strings.locale)}`
            : ''
        const statusSuffix =
          product.status !== 'PUBLISHED' ? ` [${strings.status[product.status]}]` : ''
        return {
          label: `${product.name}${statusSuffix}${formattedPrice}`,
          value: product.id,
          product,
        }
      }),
    [currency, linkProducts, strings.locale, strings.status],
  )

  const renderStatusSelect = (
    value: BitsnapStatus,
    onChange: (value: BitsnapStatus) => void,
    path: string,
  ) => (
    <SelectInput
      isClearable={false}
      label={strings.manager.statusLabel}
      name={path}
      onChange={(option) => {
        const next = Array.isArray(option) ? undefined : option?.value
        if (next === 'DRAFT' || next === 'UNPUBLISHED' || next === 'PUBLISHED') {
          onChange(next)
        }
      }}
      options={statusOptions}
      path={path}
      readOnly={!canWrite}
      value={value}
    />
  )

  const header = (
    <div className="group-field__header bitsnap-manager__header">
      <header>
        <h3 className="group-field__title">{title}</h3>
        <FieldDescription path={props.path} description={description} />
      </header>
      {account && (
        <div className="bitsnap-manager__account">
          {account.environment !== 'unknown' && (
            <Pill
              pillStyle={account.environment === 'live' ? 'success' : 'warning'}
              size="small"
            >
              {account.environment === 'live' ? strings.account.live : strings.account.test}
            </Pill>
          )}
          {account.projectName && (
            <span className="bitsnap-manager__account-project">{account.projectName}</span>
          )}
        </div>
      )}
    </div>
  )

  const readOnlyBanner = account && !account.canWrite && (
    <Banner type="info">{strings.account.readOnlyWarning}</Banner>
  )

  const banner = message && (
    <Banner
      type={
        message.tone === 'error' ? 'error' : message.tone === 'info' ? 'info' : 'success'
      }
    >
      {message.text}
    </Banner>
  )

  if (!linkedProductID) {
    return (
      <div className="group-field group-field--top-level bitsnap-manager">
        {header}
        {readOnlyBanner}
        <p className="bitsnap-manager__lead">{strings.manager.unlinkedLead}</p>
        {banner}

        <div className="bitsnap-manager__segmented" role="tablist">
          <button
            aria-selected={unlinkedMode === 'create'}
            className={`bitsnap-manager__segment${unlinkedMode === 'create' ? ' bitsnap-manager__segment--active' : ''}`}
            onClick={() => setUnlinkedMode('create')}
            role="tab"
            type="button"
          >
            {strings.manager.modeCreate}
          </button>
          <button
            aria-selected={unlinkedMode === 'link'}
            className={`bitsnap-manager__segment${unlinkedMode === 'link' ? ' bitsnap-manager__segment--active' : ''}`}
            onClick={() => setUnlinkedMode('link')}
            role="tab"
            type="button"
          >
            {strings.manager.modeLink}
          </button>
        </div>

        {unlinkedMode === 'create' ? (
          <>
            <div className="field-type row">
              <div className="row__fields">
                <div className="bitsnap-manager__col--half">
                  <TextInput
                    label={strings.manager.nameLabel}
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      setNewName(event.target.value)
                    }
                    path="bitsnapManager.newName"
                    readOnly={!canWrite}
                    value={newName ?? productTitle}
                  />
                </div>
                <div className="bitsnap-manager__col--quarter">
                  <TextInput
                    className="bitsnap-manager__numeric"
                    label={strings.manager.priceLabel(currency)}
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      setNewPrice(event.target.value)
                    }
                    path="bitsnapManager.newPrice"
                    placeholder="49,00"
                    readOnly={!canWrite}
                    value={newPrice}
                  />
                </div>
                <div className="bitsnap-manager__col--quarter">
                  {renderStatusSelect(newStatus, setNewStatus, 'bitsnapManager.newStatus')}
                </div>
              </div>
            </div>

            <div className="field-type row">
              <div className="row__fields">
                <div className="bitsnap-manager__col--third">
                  <TextInput
                    className="bitsnap-manager__numeric"
                    label={strings.manager.stockLabel}
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      setNewStock(event.target.value)
                    }
                    path="bitsnapManager.newStock"
                    placeholder={strings.manager.stockPlaceholder}
                    readOnly={!canWrite}
                    value={newStock}
                  />
                </div>
                <div className="bitsnap-manager__col--two-thirds">
                  <TextareaInput
                    description={strings.manager.imagesDescription}
                    label={strings.manager.imagesLabel}
                    onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
                      setNewImages(event.target.value)
                    }
                    path="bitsnapManager.newImages"
                    placeholder={strings.manager.imagesPlaceholder}
                    readOnly={!canWrite}
                    rows={3}
                    value={newImages}
                  />
                </div>
              </div>
            </div>

            <div className="bitsnap-manager__actions">
              <Button
                buttonStyle="primary"
                disabled={isCreating || !canWrite}
                onClick={() => {
                  void create()
                }}
              >
                {isCreating ? strings.manager.creatingButton : strings.manager.createButton}
              </Button>
            </div>
          </>
        ) : (
          <div className="bitsnap-manager__link-picker">
            <FieldLabel
              htmlFor="bitsnap-manager-link-select"
              label={strings.manager.linkSearchLabel}
              path="bitsnapManager.linkExisting"
            />
            <ReactSelect
              filterOption={() => true}
              inputId="bitsnap-manager-link-select"
              isClearable={false}
              isLoading={isLinkLoading}
              isSearchable
              noOptionsMessage={({ inputValue }) =>
                isLinkLoading
                  ? strings.productSelect.loading
                  : inputValue.trim()
                    ? strings.productSelect.noResults(inputValue.trim())
                    : strings.productSelect.noOptions
              }
              onChange={handleLinkExisting}
              onInputChange={(val) => setLinkSearchInput(val)}
              onMenuScrollToBottom={() => {
                if (linkNextCursor && !isLinkLoading) {
                  void loadLinkProducts(linkDebouncedSearch, linkNextCursor, true)
                }
              }}
              options={linkOptions}
              placeholder={strings.manager.linkSearchPlaceholder}
            />
            <p className="bitsnap-manager__lead">{strings.manager.linkSearchHelp}</p>
          </div>
        )}
      </div>
    )
  }

  const isInitialLoad = isLoading && revision === null

  return (
    <div className="group-field group-field--top-level bitsnap-manager">
      {header}
      {readOnlyBanner}
      {banner}
      {needsDocSaveReminder && <Banner type="info">{strings.manager.saveDocReminder}</Banner>}

      {isInitialLoad ? (
        <div className="bitsnap-manager__loading">
          <div className="bitsnap-manager__loading-row" />
          <div className="bitsnap-manager__loading-row" />
        </div>
      ) : (
        <>
          <div className="field-type row">
            <div className="row__fields">
              <div className="bitsnap-manager__col--third">
                {renderStatusSelect(status, setStatus, 'bitsnapManager.status')}
              </div>
              <div className="bitsnap-manager__col--third">
                <TextInput
                  className="bitsnap-manager__numeric"
                  label={strings.manager.basePriceLabel(activeCurrency)}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => setPrice(event.target.value)}
                  path="bitsnapManager.price"
                  placeholder="49,00"
                  readOnly={!canWrite}
                  value={price}
                />
              </div>
              <div className="bitsnap-manager__col--third">
                <TextInput
                  className="bitsnap-manager__numeric"
                  description={strings.manager.stockDescription}
                  label={strings.manager.stockTotalLabel}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => setStock(event.target.value)}
                  path="bitsnapManager.stock"
                  placeholder={strings.manager.stockPlaceholder}
                  readOnly={!canWrite}
                  value={stock}
                />
              </div>
            </div>
          </div>

          <section aria-labelledby="bitsnap-variants-title" className="bitsnap-manager__variants">
            <div className="bitsnap-manager__variants-header">
              <h4 className="bitsnap-manager__variants-title" id="bitsnap-variants-title">
                {strings.manager.variantsTitle}
              </h4>
              <Pill size="small">{variants.length}</Pill>
            </div>

            {variants.length === 0 ? (
              <p className="bitsnap-manager__empty">{strings.manager.variantsEmpty}</p>
            ) : (
              <div
                aria-label={strings.manager.variantsTitle}
                className="bitsnap-manager__grid"
                role="table"
              >
                <div className="bitsnap-manager__grid-head" role="row">
                  <span className="field-label" role="columnheader">
                    {strings.manager.variantNameCol}
                  </span>
                  <span className="field-label" role="columnheader">
                    {strings.manager.variantPriceCol(activeCurrency)}
                  </span>
                  <span className="field-label" role="columnheader">
                    {strings.manager.variantStockCol}
                  </span>
                  <span className="bitsnap-manager__sr-only" role="columnheader">
                    {strings.manager.variantActionsCol}
                  </span>
                </div>
                {variants.map((variant, index) => {
                  const isConfirming = confirmDeleteIndex === index

                  return (
                    <div
                      className="bitsnap-manager__grid-row"
                      key={variant.id ?? `new-${index}`}
                      role="row"
                    >
                      <div role="cell">
                        <TextInput
                          onChange={(event: ChangeEvent<HTMLInputElement>) =>
                            updateVariant(index, { name: event.target.value })
                          }
                          path={`bitsnapManager.variants.${index}.name`}
                          placeholder={strings.manager.variantNamePlaceholder(index + 1)}
                          readOnly={!canWrite}
                          value={variant.name}
                        />
                      </div>
                      <div role="cell">
                        <TextInput
                          className="bitsnap-manager__numeric"
                          onChange={(event: ChangeEvent<HTMLInputElement>) =>
                            updateVariant(index, { price: event.target.value })
                          }
                          path={`bitsnapManager.variants.${index}.price`}
                          placeholder="49,00"
                          readOnly={!canWrite}
                          value={variant.price}
                        />
                      </div>
                      <div role="cell">
                        <TextInput
                          className="bitsnap-manager__numeric"
                          onChange={(event: ChangeEvent<HTMLInputElement>) =>
                            updateVariant(index, { stock: event.target.value })
                          }
                          path={`bitsnapManager.variants.${index}.stock`}
                          placeholder={strings.manager.variantStockPlaceholder}
                          readOnly={!canWrite}
                          value={variant.stock}
                        />
                      </div>
                      <div className="bitsnap-manager__remove" role="cell">
                        {isConfirming ? (
                          <div className="bitsnap-manager__inline-confirm">
                            <Button
                              buttonStyle="error"
                              onClick={() => removeVariant(index)}
                              size="small"
                            >
                              {strings.manager.confirmDelete}
                            </Button>
                            <Button
                              buttonStyle="subtle"
                              onClick={() => setConfirmDeleteIndex(null)}
                              size="small"
                            >
                              {strings.manager.cancelDelete}
                            </Button>
                          </div>
                        ) : (
                          <Button
                            aria-label={strings.manager.removeVariantAria(
                              variant.name || String(index + 1),
                            )}
                            buttonStyle="icon-label"
                            disabled={!canWrite}
                            icon="x"
                            onClick={() => {
                              if (variant.id) {
                                setConfirmDeleteIndex(index)
                              } else {
                                removeVariant(index)
                              }
                            }}
                            round
                            tooltip={strings.manager.removeVariantTooltip}
                          />
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <Button
              buttonStyle="icon-label"
              disabled={!canWrite}
              icon="plus"
              iconPosition="left"
              iconStyle="with-border"
              onClick={() =>
                setVariants((current) => [...current, { name: '', price: '', stock: '' }])
              }
            >
              {strings.manager.addVariant}
            </Button>
          </section>
        </>
      )}

      <div className="bitsnap-manager__actions">
        <Button
          buttonStyle="primary"
          disabled={isSaving || isLoading || revision === null || !canWrite}
          onClick={() => {
            void save()
          }}
        >
          {isSaving ? strings.manager.savingButton : strings.manager.saveButton}
        </Button>
        <Button
          buttonStyle="secondary"
          disabled={isLoading || isSaving}
          onClick={() => {
            void load()
          }}
        >
          {isLoading && !isInitialLoad
            ? strings.manager.refreshingButton
            : strings.manager.refreshButton}
        </Button>
        <Button
          buttonStyle="subtle"
          disabled={isSaving || isLoading}
          onClick={handleUnlink}
        >
          {strings.manager.unlinkButton}
        </Button>
        <Button
          buttonStyle="subtle"
          className="bitsnap-manager__open"
          el="anchor"
          newTab
          url={`${host}/app/product/${encodeURIComponent(linkedProductID)}`}
        >
          {strings.manager.openInBitsnap}
        </Button>
      </div>

      <div className="bitsnap-manager__meta">
        <span>{strings.manager.productMetaLabel}</span>
        <code>{linkedProductID}</code>
        <CopyToClipboard value={linkedProductID} />
      </div>
    </div>
  )
}
