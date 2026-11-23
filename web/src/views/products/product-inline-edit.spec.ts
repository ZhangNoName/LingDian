import { describe, expect, it } from 'vitest'
import { captureSkuValue, createPendingSkuChange, revertSkuChange } from './product-inline-edit'
import type { ProductSku } from './types'

function sku(): ProductSku {
  return {
    id: 'sku-1',
    product_id: 'product-1',
    sku_name: '单品',
    price: 10,
    stock_count: 2,
    is_default: true,
    is_active: true,
  }
}

describe('product inline editing', () => {
  it('captures and restores the value shown before editing', () => {
    const item = sku()
    captureSkuValue(item, 'price')
    item.price = 12
    const change = createPendingSkuChange(item, 'price')

    expect(change).toMatchObject({ oldValue: 10, newValue: 12 })
    if (change) revertSkuChange(change)
    expect(item.price).toBe(10)
  })

  it('does not queue an unchanged value', () => {
    const item = sku()
    captureSkuValue(item, 'stock_count')
    expect(createPendingSkuChange(item, 'stock_count')).toBeNull()
  })
})
