export type ProductType = 'SINGLE' | 'PACKAGE'
export type SelectionScope = 'PRODUCT' | 'VARIANT'
export type SelectionGroupType = 'MODIFIER' | 'COMPONENT'
export type SelectionMode = 'SINGLE' | 'MULTIPLE'
export type SelectionOptionType = 'VALUE' | 'VARIANT'

export interface ProductSku {
  id: string
  product_id: string
  sku_name: string
  price: number
  stock_count: number
  is_default: boolean
  is_active: boolean
  _originalPrice?: number
  _originalStock?: number
}

export interface SelectionOption {
  id: string
  name: string
  option_type: SelectionOptionType
  price_delta: number
  stock_delta: number
  is_default: boolean
  is_active: boolean
  sort_order: number
  referenced_sku_id: string | null
  referenced_sku_name: string | null
  referenced_product_id: string | null
  referenced_product_name: string | null
}

export interface ProductSelectionGroup {
  binding_id: string
  scope: SelectionScope
  target_variant_id: string | null
  sort_order: number
  is_enabled: boolean
  group: {
    id: string
    name: string
    group_type: SelectionGroupType
    selection_mode: SelectionMode
    min_select: number
    max_select: number
    is_required: boolean
    is_active: boolean
    sort_order: number
    description: string | null
    options: SelectionOption[]
  }
}

export interface ProductRecord {
  id: string
  store_id: string
  name: string
  description?: string | null
  type: ProductType
  is_active: boolean
  status: string
  category: string
  category_id: string
  skus: ProductSku[]
  selection_groups: ProductSelectionGroup[]
}

export interface ProductVariantForm {
  id?: string
  sku_name: string
  price: number
  stock_count: number
  is_default: boolean
  is_active: boolean
}

export interface SelectionOptionForm {
  id?: string
  name: string
  option_type: SelectionOptionType
  price_delta: number
  stock_delta: number
  is_default: boolean
  is_active: boolean
  sort_order: number
  referenced_sku_id?: string
}

export interface ProductSelectionGroupForm {
  id?: string
  name: string
  group_type: SelectionGroupType
  selection_mode: SelectionMode
  min_select: number
  max_select: number
  is_required: boolean
  is_active: boolean
  sort_order: number
  description: string
  options: SelectionOptionForm[]
}

export interface ProductSelectionBindingForm {
  id?: string
  scope: SelectionScope
  target_variant_id?: string
  sort_order: number
  is_enabled: boolean
  group: ProductSelectionGroupForm
}

export interface ProductConfigForm {
  type: ProductType
  variants: ProductVariantForm[]
  selection_groups: ProductSelectionBindingForm[]
}
