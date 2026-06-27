import type {
  ProductConfigContract,
  ProductConfigSelectionBindingContract,
  ProductConfigSelectionGroupContract,
  ProductConfigSelectionOptionContract,
  ProductConfigVariantContract,
  ProductRecordContract,
  ProductSelectionGroupContract,
  ProductSkuContract,
  ProductType as ContractProductType,
  SelectionGroupType as ContractSelectionGroupType,
  SelectionMode as ContractSelectionMode,
  SelectionOptionContract,
  SelectionOptionType as ContractSelectionOptionType,
  SelectionScope as ContractSelectionScope,
} from '@lingdian/contracts'

export type ProductType = ContractProductType
export type SelectionScope = ContractSelectionScope
export type SelectionGroupType = ContractSelectionGroupType
export type SelectionMode = ContractSelectionMode
export type SelectionOptionType = ContractSelectionOptionType

export interface ProductSku extends ProductSkuContract {
  _originalPrice?: number
  _originalStock?: number
}

export type SelectionOption = SelectionOptionContract
export type ProductSelectionGroup = ProductSelectionGroupContract

export interface ProductRecord extends Omit<ProductRecordContract, 'skus'> {
  skus: ProductSku[]
}

export type ProductVariantForm = ProductConfigVariantContract
export type SelectionOptionForm = ProductConfigSelectionOptionContract
export type ProductSelectionGroupForm = ProductConfigSelectionGroupContract
export type ProductSelectionBindingForm = ProductConfigSelectionBindingContract
export type ProductConfigForm = ProductConfigContract
