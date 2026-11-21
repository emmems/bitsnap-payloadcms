import type { CollectionConfig, TextField } from 'payload'
import { describe, expect, it } from 'vitest'

import { DEFAULT_PRODUCT_ID_PATH } from '../src/constants.js'
import {
  BITSNAP_LINK_TO_DOC_COMPONENT_PATH,
  BITSNAP_MANAGER_COMPONENT_PATH,
  BITSNAP_PRODUCT_ROW_LABEL_COMPONENT_PATH,
  BITSNAP_PRODUCT_SELECT_COMPONENT_PATH,
  bitsnapManagerField,
  getFields,
  mergeFieldOverrides,
  productSelectField,
} from '../src/fields/getFields.js'
import { sanitizeBitsnapPluginConfig } from '../src/plugin.js'

describe('zero-config field helpers', () => {
  it('builds bitsnapManagerField with zero arguments and deep-merges overrides', () => {
    const defaultField = bitsnapManagerField()
    expect(defaultField.type).toBe('ui')
    expect(defaultField.name).toBe('bitsnapManager')
    expect(defaultField.admin?.components?.Field).toEqual({
      path: BITSNAP_MANAGER_COMPONENT_PATH,
    })
    expect(defaultField.admin?.custom?.productIdPath).toBe(DEFAULT_PRODUCT_ID_PATH)

    const customized = bitsnapManagerField({
      productIdPath: 'customBitsnapId',
      overrides: {
        admin: {
          width: '50%',
          custom: { extra: 'yes' },
        },
      },
    })

    expect(customized.admin?.width).toBe('50%')
    expect(customized.admin?.components?.Field).toEqual({
      path: BITSNAP_MANAGER_COMPONENT_PATH,
    })
    expect(customized.admin?.custom).toEqual({
      productIdPath: 'customBitsnapId',
      extra: 'yes',
    })
  })

  it('builds productSelectField with zero arguments and preserves components on override', () => {
    const defaultField = productSelectField()
    expect(defaultField.type).toBe('text')
    expect(defaultField.name).toBe('productID')
    expect(defaultField.admin?.components?.Field).toEqual({
      path: BITSNAP_PRODUCT_SELECT_COMPONENT_PATH,
    })
    expect(defaultField.admin?.custom?.allowDrafts).toBe(false)

    const customized = productSelectField({
      allowDrafts: true,
      overrides: {
        name: 'featuredProductId',
        required: true,
        admin: {
          width: '50%',
        },
      },
    })

    expect(customized.name).toBe('featuredProductId')
    expect(customized.required).toBe(true)
    expect(customized.admin?.width).toBe('50%')
    expect(customized.admin?.components?.Field).toEqual({
      path: BITSNAP_PRODUCT_SELECT_COMPONENT_PATH,
    })
    expect(customized.admin?.custom?.allowDrafts).toBe(true)
  })

  it('does not mutate the base field in mergeFieldOverrides', () => {
    const base: TextField = {
      name: 'productID',
      type: 'text',
      admin: {
        components: { Field: BITSNAP_PRODUCT_SELECT_COMPONENT_PATH },
        custom: { allowDrafts: false },
      },
    }

    const merged = mergeFieldOverrides(base, {
      admin: {
        width: '50%',
        custom: { allowDrafts: true },
      },
    })

    expect(base.admin?.width).toBeUndefined()
    expect(base.admin?.custom?.allowDrafts).toBe(false)
    expect(merged.admin?.width).toBe('50%')
    expect(merged.admin?.custom?.allowDrafts).toBe(true)
    expect(merged.admin?.components?.Field).toBe(BITSNAP_PRODUCT_SELECT_COMPONENT_PATH)
  })

  it('exports BITSNAP_PRODUCT_ROW_LABEL_COMPONENT_PATH', () => {
    expect(BITSNAP_PRODUCT_ROW_LABEL_COMPONENT_PATH).toBe(
      'bitsnap-payloadcms/client#BitsnapProductRowLabel',
    )
  })

  it('appends bitsnapID, skipSync, and docUrl in getFields without mutating existing fields', () => {
    const collection = {
      slug: 'products',
      fields: [{ name: 'title', type: 'text' }],
    } as CollectionConfig

    const fields = getFields({
      collection,
      pluginConfig: sanitizeBitsnapPluginConfig({ bitsnapApiKey: 'bs_test_1' }),
      syncConfig: { collection: 'products', fields: [] },
    })

    expect(fields.map((f) => ('name' in f ? f.name : ''))).toEqual([
      'title',
      'bitsnapID',
      'skipSync',
      'docUrl',
    ])

    const docUrl = fields[3]
    expect(docUrl.type).toBe('ui')
    if (docUrl.type === 'ui') {
      expect(docUrl.admin?.components?.Field).toEqual({
        path: BITSNAP_LINK_TO_DOC_COMPONENT_PATH,
      })
      expect(docUrl.admin?.custom?.nameOfIDField).toBe('bitsnapID')
    }
  })
})
