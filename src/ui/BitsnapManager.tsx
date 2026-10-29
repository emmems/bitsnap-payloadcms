'use client'

import {
  Banner,
  Button,
  CopyToClipboard,
  FieldDescription,
  Pill,
  SelectInput,
  TextInput,
  useForm,
  useFormFields,
} from '@payloadcms/ui'
import type { UIFieldClientProps } from 'payload'
import { type ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react'

import type { BitsnapClientConfig } from '../types.js'
import { getBitsnapClientConfig } from './getBitsnapClientConfig.js'

import './BitsnapManager.css'

export type BitsnapManagerProps = UIFieldClientProps & Partial<BitsnapClientConfig>

type ManagedStatus = 'DRAFT' | 'UNPUBLISHED' | 'PUBLISHED'

type ManagedVariant = {
  id: string
  name: string
  priceAmount: number | null
  priceCurrency: string | null
  availableQuantity: number | null
}

type ManagedProduct = {
  id: string
  name: string
  status: ManagedStatus
  priceAmount: number | null
  priceCurrency: string | null
  availableQuantity: number | null
  variants: ManagedVariant[]
  revision: number
}

type VariantRow = {
  id?: string
  name: string
  price: string
  stock: string
}

type Message = {
  tone: 'success' | 'error'
  text: string
}

const statusLabels: Record<ManagedStatus, string> = {
  DRAFT: 'Szkic',
  UNPUBLISHED: 'Nieopublikowany',
  PUBLISHED: 'Opublikowany',
}

/**
 * Matches any field path that ends with `productID` — layout agnostic on purpose,
 * the plugin must not depend on a specific block layout of the consuming app.
 */
const productIDPathPattern = /(?:^|\.)productID$/

/**
 * Extracts the numeric index of a block/array row out of a field path
 * (`layout.2.productID` -> `2`). Paths without an index sort last.
 */
const getPathIndex = (path: string): number => {
  const match = /(?:^|\.)(\d+)(?:\.|$)/.exec(path)

  if (!match || match[1] === undefined) {
    return Number.MAX_SAFE_INTEGER
  }

  return Number(match[1])
}

const getProductIDPaths = (fields: Record<string, { value?: unknown }>): string[] =>
  Object.keys(fields)
    .filter((path) => productIDPathPattern.test(path))
    .sort((a, b) => {
      const indexA = getPathIndex(a)
      const indexB = getPathIndex(b)

      if (indexA !== indexB) {
        return indexA - indexB
      }

      return a.localeCompare(b)
    })

const groszeToZl = (grosze: number | null): string =>
  grosze === null ? '' : (grosze / 100).toFixed(2).replace('.', ',')

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

export const BitsnapManager = (props: BitsnapManagerProps) => {
  const { dispatchFields } = useForm()
  const { apiBaseUrl, currency, dashboardUrl } = getBitsnapClientConfig(props)

  const description =
    typeof props.field.admin?.description === 'string' ? props.field.admin.description : undefined

  const productIDPathsKey = useFormFields(([fields]) => getProductIDPaths(fields).join(','))

  const productIDPaths = useMemo(
    () => (productIDPathsKey === '' ? [] : productIDPathsKey.split(',')),
    [productIDPathsKey],
  )

  const linkedProductID = useFormFields(([fields]) => {
    for (const path of getProductIDPaths(fields)) {
      const value = fields[path]?.value
      if (typeof value === 'string' && value !== '') return value
    }
    return null
  })

  const productTitle = useFormFields(([fields]) => {
    const value = fields.title?.value
    return typeof value === 'string' ? value : ''
  })

  const [status, setStatus] = useState<ManagedStatus>('DRAFT')
  const [price, setPrice] = useState('')
  const [stock, setStock] = useState('')
  const [variants, setVariants] = useState<VariantRow[]>([])
  const [revision, setRevision] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<Message | null>(null)

  const [newName, setNewName] = useState<string | null>(null)
  const [newPrice, setNewPrice] = useState('')
  const [newStatus, setNewStatus] = useState<ManagedStatus>('DRAFT')
  const [isCreating, setIsCreating] = useState(false)
  const [createdProductID, setCreatedProductID] = useState<string | null>(null)

  const applyProduct = useCallback((product: ManagedProduct) => {
    setStatus(product.status)
    setPrice(groszeToZl(product.priceAmount))
    setStock(product.availableQuantity === null ? '' : String(product.availableQuantity))
    setRevision(product.revision)
    setVariants(
      product.variants.map((variant) => ({
        id: variant.id,
        name: variant.name,
        price: groszeToZl(variant.priceAmount),
        stock: variant.availableQuantity === null ? '' : String(variant.availableQuantity),
      })),
    )
  }, [])

  const load = useCallback(async (): Promise<boolean> => {
    if (!linkedProductID) {
      setRevision(null)
      setVariants([])
      return false
    }

    setIsLoading(true)
    setMessage(null)

    try {
      const response = await fetch(
        `${apiBaseUrl}/products/${encodeURIComponent(linkedProductID)}`,
      )
      const payload = (await response.json()) as { product?: ManagedProduct; error?: string }

      if (!response.ok || !payload.product) {
        throw new Error(payload.error ?? 'Nie udało się pobrać produktu z Bitsnapa')
      }

      applyProduct(payload.product)
      return true
    } catch (error) {
      setMessage({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Nie udało się pobrać produktu z Bitsnapa',
      })
      return false
    } finally {
      setIsLoading(false)
    }
  }, [apiBaseUrl, applyProduct, linkedProductID])

  useEffect(() => {
    void load()
  }, [load])

  const save = useCallback(async () => {
    if (!linkedProductID || revision === null) return

    const priceAmount = parsePrice(price)
    const availableQuantity = parseQuantity(stock)

    if (priceAmount === null) {
      setMessage({ tone: 'error', text: 'Cena bazowa musi być liczbą' })
      return
    }

    if (availableQuantity === null) {
      setMessage({ tone: 'error', text: 'Limit sztuk musi być liczbą' })
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
        setMessage({ tone: 'error', text: 'Nazwa wariantu jest wymagana' })
        return
      }

      if (variantPrice === null || variantPrice === undefined) {
        setMessage({ tone: 'error', text: `Cena wariantu „${name}” jest wymagana` })
        return
      }

      if (variantStock === null) {
        setMessage({ tone: 'error', text: `Limit sztuk wariantu „${name}” musi być liczbą` })
        return
      }

      payloadVariants.push({
        ...(variant.id ? { id: variant.id } : {}),
        name,
        priceAmount: variantPrice,
        priceCurrency: currency,
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
            ...(priceAmount === undefined ? {} : { priceAmount }),
            ...(availableQuantity === undefined ? {} : { availableQuantity }),
            variants: payloadVariants,
          }),
          headers: { 'Content-Type': 'application/json' },
          method: 'PATCH',
        },
      )

      const payload = (await response.json()) as { error?: string }

      if (!response.ok) {
        if (response.status === 409) {
          setMessage({ tone: 'error', text: 'Produkt zmienił się w Bitsnap — kliknij Odśwież' })
          return
        }

        throw new Error(payload.error ?? 'Nie udało się zapisać produktu w Bitsnapie')
      }

      const reloaded = await load()

      if (reloaded) {
        setMessage({ tone: 'success', text: 'Zapisano w Bitsnapie' })
      }
    } catch (error) {
      setMessage({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Nie udało się zapisać produktu w Bitsnapie',
      })
    } finally {
      setIsSaving(false)
    }
  }, [apiBaseUrl, currency, linkedProductID, load, price, revision, status, stock, variants])

  const create = useCallback(async () => {
    const name = (newName ?? productTitle).trim()
    const priceAmount = parsePrice(newPrice)

    if (name === '') {
      setMessage({ tone: 'error', text: 'Podaj nazwę produktu' })
      return
    }

    if (priceAmount === null || priceAmount === undefined) {
      setMessage({ tone: 'error', text: 'Podaj cenę produktu w zł' })
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
        }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      })

      const payload = (await response.json()) as { id?: string; error?: string }

      if (!response.ok || !payload.id) {
        throw new Error(payload.error ?? 'Nie udało się utworzyć produktu w Bitsnapie')
      }

      setCreatedProductID(payload.id)

      const targetPath = productIDPaths[0]

      if (targetPath) {
        dispatchFields({ path: targetPath, type: 'UPDATE', value: payload.id })
        setMessage({
          tone: 'success',
          text: `Utworzono produkt ${payload.id} i przypisano go do bloku produktu`,
        })
      } else {
        setMessage({
          tone: 'success',
          text: `Utworzono produkt ${payload.id}. Dodaj blok produktu i wybierz ten produkt.`,
        })
      }
    } catch (error) {
      setMessage({
        tone: 'error',
        text:
          error instanceof Error ? error.message : 'Nie udało się utworzyć produktu w Bitsnapie',
      })
    } finally {
      setIsCreating(false)
    }
  }, [apiBaseUrl, currency, dispatchFields, newName, newPrice, newStatus, productIDPaths, productTitle])

  const updateVariant = (index: number, patch: Partial<VariantRow>) => {
    setVariants((current) =>
      current.map((variant, variantIndex) =>
        variantIndex === index ? { ...variant, ...patch } : variant,
      ),
    )
  }

  const statusOptions = (Object.keys(statusLabels) as ManagedStatus[]).map((option) => ({
    label: statusLabels[option],
    value: option,
  }))

  const renderStatusSelect = (
    value: ManagedStatus,
    onChange: (value: ManagedStatus) => void,
    path: string,
  ) => (
    <SelectInput
      isClearable={false}
      label="Status"
      name={path}
      onChange={(option) => {
        const next = Array.isArray(option) ? undefined : option?.value
        if (next === 'DRAFT' || next === 'UNPUBLISHED' || next === 'PUBLISHED') {
          onChange(next)
        }
      }}
      options={statusOptions}
      path={path}
      value={value}
    />
  )

  const header = (
    <div className="group-field__header">
      <header>
        <h3 className="group-field__title">
          {typeof props.field.label === 'string' ? props.field.label : 'Bitsnap'}
        </h3>
        <FieldDescription path={props.path} description={description} />
      </header>
    </div>
  )

  const banner = message && (
    <Banner type={message.tone === 'error' ? 'error' : 'success'}>{message.text}</Banner>
  )

  if (!linkedProductID) {
    return (
      <div className="group-field group-field--top-level bitsnap-manager">
        {header}
        <p className="bitsnap-manager__lead">
          Ten produkt nie jest jeszcze powiązany z Bitsnapem. Utwórz go tutaj — id trafi do bloku
          produktu.
        </p>
        {banner}
        <div className="field-type row">
          <div className="row__fields">
            <div className="bitsnap-manager__col--half">
              <TextInput
                label="Nazwa"
                onChange={(event: ChangeEvent<HTMLInputElement>) => setNewName(event.target.value)}
                path="bitsnapManager.newName"
                value={newName ?? productTitle}
              />
            </div>
            <div className="bitsnap-manager__col--quarter">
              <TextInput
                label="Cena (zł)"
                onChange={(event: ChangeEvent<HTMLInputElement>) => setNewPrice(event.target.value)}
                path="bitsnapManager.newPrice"
                placeholder="49,00"
                value={newPrice}
              />
            </div>
            <div className="bitsnap-manager__col--quarter">
              {renderStatusSelect(newStatus, setNewStatus, 'bitsnapManager.newStatus')}
            </div>
          </div>
        </div>

        {createdProductID && productIDPaths.length === 0 && (
          <Banner type="info">
            Dodaj blok produktu (np. Zdjęcie produktu) i wybierz w nim produkt {createdProductID}.
          </Banner>
        )}

        <div className="bitsnap-manager__actions">
          <Button
            buttonStyle="primary"
            disabled={isCreating}
            onClick={() => {
              void create()
            }}
          >
            {isCreating ? 'Tworzenie…' : 'Utwórz produkt w Bitsnap'}
          </Button>
        </div>
      </div>
    )
  }

  const isInitialLoad = isLoading && revision === null

  return (
    <div className="group-field group-field--top-level bitsnap-manager">
      {header}
      {banner}

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
                  label="Cena bazowa (zł)"
                  onChange={(event: ChangeEvent<HTMLInputElement>) => setPrice(event.target.value)}
                  path="bitsnapManager.price"
                  placeholder="49,00"
                  value={price}
                />
              </div>
              <div className="bitsnap-manager__col--third">
                <TextInput
                  description="Sprzedane i zarezerwowane sztuki są od niego odejmowane. Puste pole — bez zmian."
                  label="Limit sztuk (łącznie)"
                  onChange={(event: ChangeEvent<HTMLInputElement>) => setStock(event.target.value)}
                  path="bitsnapManager.stock"
                  placeholder="np. 100"
                  value={stock}
                />
              </div>
            </div>
          </div>

          <section aria-labelledby="bitsnap-variants-title" className="bitsnap-manager__variants">
            <div className="bitsnap-manager__variants-header">
              <h4 className="bitsnap-manager__variants-title" id="bitsnap-variants-title">
                Warianty
              </h4>
              <Pill size="small">{variants.length}</Pill>
            </div>

            {variants.length === 0 ? (
              <p className="bitsnap-manager__empty">
                Brak wariantów — produkt sprzedaje się w jednej wersji.
              </p>
            ) : (
              <div className="bitsnap-manager__grid" role="table" aria-label="Warianty">
                <div className="bitsnap-manager__grid-head" role="row">
                  <span className="field-label" role="columnheader">
                    Nazwa
                  </span>
                  <span className="field-label" role="columnheader">
                    Cena (zł)
                  </span>
                  <span className="field-label" role="columnheader">
                    Limit sztuk
                  </span>
                  <span role="columnheader" className="bitsnap-manager__sr-only">
                    Akcje
                  </span>
                </div>
                {variants.map((variant, index) => (
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
                        placeholder={`Wariant ${index + 1}, np. M`}
                        value={variant.name}
                      />
                    </div>
                    <div role="cell">
                      <TextInput
                        onChange={(event: ChangeEvent<HTMLInputElement>) =>
                          updateVariant(index, { price: event.target.value })
                        }
                        path={`bitsnapManager.variants.${index}.price`}
                        placeholder="49,00"
                        value={variant.price}
                      />
                    </div>
                    <div role="cell">
                      <TextInput
                        onChange={(event: ChangeEvent<HTMLInputElement>) =>
                          updateVariant(index, { stock: event.target.value })
                        }
                        path={`bitsnapManager.variants.${index}.stock`}
                        placeholder="np. 10"
                        value={variant.stock}
                      />
                    </div>
                    <div role="cell" className="bitsnap-manager__remove">
                      <Button
                        aria-label={`Usuń wariant ${variant.name || index + 1}`}
                        buttonStyle="icon-label"
                        icon="x"
                        onClick={() =>
                          setVariants((current) => current.filter((_, i) => i !== index))
                        }
                        round
                        tooltip="Usuń wariant"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Button
              buttonStyle="icon-label"
              icon="plus"
              iconPosition="left"
              iconStyle="with-border"
              onClick={() =>
                setVariants((current) => [...current, { name: '', price: '', stock: '' }])
              }
            >
              Dodaj wariant
            </Button>
          </section>
        </>
      )}

      <div className="bitsnap-manager__actions">
        <Button
          buttonStyle="primary"
          disabled={isSaving || isLoading || revision === null}
          onClick={() => {
            void save()
          }}
        >
          {isSaving ? 'Zapisywanie…' : 'Zapisz w Bitsnap'}
        </Button>
        <Button
          buttonStyle="secondary"
          disabled={isLoading || isSaving}
          onClick={() => {
            void load()
          }}
        >
          {isLoading && !isInitialLoad ? 'Odświeżanie…' : 'Odśwież'}
        </Button>
        <Button
          buttonStyle="subtle"
          className="bitsnap-manager__open"
          el="anchor"
          newTab
          url={`${dashboardUrl}/app/product/${encodeURIComponent(linkedProductID)}`}
        >
          Otwórz w Bitsnap
        </Button>
      </div>

      <div className="bitsnap-manager__meta">
        <span>Produkt w Bitsnap</span>
        <code>{linkedProductID}</code>
        <CopyToClipboard value={linkedProductID} />
      </div>
    </div>
  )
}
