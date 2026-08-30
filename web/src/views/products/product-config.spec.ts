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
