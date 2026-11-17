import { describe, expect, it } from 'vitest'
import { normalizeProductConfig } from './product-config'
import type { ProductConfigForm } from './types'

function config(defaults: boolean[]): ProductConfigForm {
  return {
    type: 'SINGLE',
    variants: defaults.map((isDefault, index) => ({
      id: `sku-${index + 1}`,
      sku_name: `规格 ${index + 1}`,
      price: 10,
      stock_count: 1,
      is_default: isDefault,
      is_active: true,
    })),
    selection_groups: [],
  }
}

describe('product config normalization', () => {
  it('preserves a non-first selected default without also selecting the first variant', () => {
    const normalized = normalizeProductConfig(config([false, true]))

    expect(normalized.variants.map((variant) => variant.is_default)).toEqual([false, true])
  })

  it('falls back to exactly one first default when none is selected', () => {
    const normalized = normalizeProductConfig(config([false, false, false]))

    expect(normalized.variants.map((variant) => variant.is_default)).toEqual([true, false, false])
  })

  it('collapses malformed multiple defaults to exactly one', () => {
    const normalized = normalizeProductConfig(config([false, true, true]))

    expect(normalized.variants.map((variant) => variant.is_default)).toEqual([false, true, false])
  })
})

import {
  createProductVariant,
  validateProductConfig,
  createProductConfigDraft,
  createSelectionBinding,
} from './product-config'
it('keeps a product version and selects an enabled default without changing existing variant ids', () => {
  const draft = config([true, false])
  draft.expected_version = 7
  draft.variants[0]!.is_active = false
  const normalized = normalizeProductConfig(draft)
  expect(normalized.expected_version).toBe(7)
  expect(normalized.variants.map((variant) => variant.id)).toEqual(['sku-1', 'sku-2'])
  expect(normalized.variants.map((variant) => variant.is_default)).toEqual([false, true])
  expect(createProductVariant(false).id).toMatch(/^draft_/)
})
it('rejects blank names, fractional reference quantities and broken choice bindings', () => {
  const draft = config([true])
  draft.variants[0]!.sku_name = ' '
  expect(validateProductConfig(draft)).toBe('nameRequired')
  draft.variants[0]!.sku_name = 'Regular'
  draft.variants[0]!.stock_count = 1.5
  expect(validateProductConfig(draft)).toBe('numericInvalid')
})
it('creates an independent draft and preserves the concurrency version', () => {
  const product = {
    type: 'SINGLE',
    configuration_version: 3,
    skus: [{ id: 's1', sku_name: 'Regular', price: 10, stock_count: 2, is_active: true, is_default: true }],
    selection_groups: [],
  } as never
  const draft = createProductConfigDraft(product)
  expect(draft.expected_version).toBe(3)
  draft.variants[0]!.price = 20
  expect((product as any).skus[0].price).toBe(10)
})

it('rejects cleared quantities and impossible required groups before saving hidden tabs', () => {
  const draft = config([true])
  draft.variants[0]!.stock_count = '' as never
  expect(validateProductConfig(draft)).toBe('numericInvalid')
  draft.variants[0]!.stock_count = 0
  const binding = createSelectionBinding(0)
  binding.group.name = 'Temperature'
  binding.group.options[0]!.name = 'Hot'
  binding.group.is_required = true
  binding.group.max_select = 0
  draft.selection_groups.push(binding)
  expect(validateProductConfig(draft)).toBe('rulesInvalid')
  binding.group.max_select = 1
  binding.scope = 'VARIANT'
  binding.target_variant_id = 'missing'
  expect(validateProductConfig(draft)).toBe('referenceRequired')
})
