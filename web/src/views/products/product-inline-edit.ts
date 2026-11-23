import type { ProductSku } from './types'

export type SkuField = 'price' | 'stock_count'

export type PendingSkuChange = {
  sku: ProductSku
  field: SkuField
  label: string
  oldValue: number
  newValue: number
}

export function captureSkuValue(sku: ProductSku, field: SkuField): void {
  if (field === 'price') sku._originalPrice = sku.price
  else sku._originalStock = sku.stock_count
}

export function createPendingSkuChange(sku: ProductSku, field: SkuField): PendingSkuChange | null {
  const oldValue = field === 'price' ? sku._originalPrice : sku._originalStock
  const newValue = sku[field]
  if (oldValue === undefined || Number(oldValue) === Number(newValue)) return null

  return {
    sku,
    field,
    label: field === 'price' ? '售价' : '库存',
    oldValue: Number(oldValue),
    newValue: Number(newValue),
  }
}

export function revertSkuChange(change: PendingSkuChange): void {
  change.sku[change.field] = change.oldValue
}

export function formatSkuValue(field: SkuField, value: number): string {
  return field === 'price' ? `¥${value.toFixed(2)}` : `${value}`
}
