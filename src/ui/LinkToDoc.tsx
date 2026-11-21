'use client'

import { CopyToClipboard, useFormFields } from '@payloadcms/ui'
import type { UIFieldClientProps } from 'payload'

import { DEFAULT_PRODUCT_ID_PATH } from '../constants.js'
import type { BitsnapClientConfig } from '../types.js'
import { useBitsnapClientConfig } from './getBitsnapClientConfig.js'
import { useBitsnapStrings } from './i18n.js'

export type LinkToDocProps = UIFieldClientProps & Partial<BitsnapClientConfig>

export const LinkToDoc = (props: LinkToDocProps) => {
  const { host } = useBitsnapClientConfig(props)
  const strings = useBitsnapStrings()

  const custom = props.field.admin?.custom
  const nameOfIDField =
    typeof custom?.nameOfIDField === 'string' && custom.nameOfIDField.trim() !== ''
      ? custom.nameOfIDField
      : DEFAULT_PRODUCT_ID_PATH

  const field = useFormFields(([fields]) => (fields && fields[nameOfIDField]) || null)
  const rawValue = field?.value
  const bitsnapID = typeof rawValue === 'string' ? rawValue.trim() : ''

  if (!bitsnapID) {
    return null
  }

  const href = `${host}/app/product/${encodeURIComponent(bitsnapID)}`

  return (
    <div>
      <div>
        <span
          className="label"
          style={{
            color: 'var(--theme-elevation-500, #9A9A9A)',
          }}
        >
          {strings.linkToDoc.label}
        </span>
        <CopyToClipboard value={href} />
      </div>
      <div
        style={{
          fontWeight: '600',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        <a href={href} rel="noreferrer noopener" target="_blank">
          {href}
        </a>
      </div>
    </div>
  )
}
