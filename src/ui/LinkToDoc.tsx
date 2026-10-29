'use client'

import { CopyToClipboard, useFormFields } from '@payloadcms/ui'
import type { UIFieldClientProps } from 'payload'

import type { BitsnapClientConfig } from '../types.js'
import { getBitsnapClientConfig } from './getBitsnapClientConfig.js'

export type LinkToDocProps = UIFieldClientProps & Partial<BitsnapClientConfig>

export const LinkToDoc = (props: LinkToDocProps) => {
  const { dashboardUrl } = getBitsnapClientConfig(props)

  const custom = props.field.admin?.custom
  const nameOfIDField =
    typeof custom?.nameOfIDField === 'string' ? custom.nameOfIDField : 'bitsnapID'

  const field = useFormFields(([fields]) => (fields && fields?.[nameOfIDField]) || null)
  const bitsnapID = field?.value

  const href = `${dashboardUrl}/app`

  if (bitsnapID) {
    return (
      <div>
        <div>
          <span
            className="label"
            style={{
              color: 'var(--theme-elevation-500, #9A9A9A)',
            }}
          >
            Zobacz w Bitsnapie
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

  return null
}
