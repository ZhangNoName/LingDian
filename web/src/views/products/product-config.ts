import type {
  ProductConfigForm,
  ProductRecord,
  ProductSelectionBindingForm,
  ProductVariantForm,
  SelectionOptionForm,
} from './types'

export function createProductConfigDraft(product: ProductRecord): ProductConfigForm {
  return {
    type: product.type,
    variants: product.skus.map((sku) => ({
      id: sku.id,
      sku_name: sku.sku_name,
      price: sku.price,
      stock_count: sku.stock_count,
      is_default: sku.is_default,
      is_active: sku.is_active,
    })),
    selection_groups: product.selection_groups.map((binding) => ({
      id: binding.binding_id,
      scope: binding.scope,
      target_variant_id: binding.target_variant_id ?? undefined,
      sort_order: binding.sort_order,
      is_enabled: binding.is_enabled,
      group: {
        id: binding.group.id,
        name: binding.group.name,
        group_type: binding.group.group_type,
        selection_mode: binding.group.selection_mode,
        min_select: binding.group.min_select,
        max_select: binding.group.max_select,
        is_required: binding.group.is_required,
        is_active: binding.group.is_active,
        sort_order: binding.group.sort_order,
        description: binding.group.description ?? '',
        options: binding.group.options.map((option) => ({
          id: option.id,
          name: option.name,
          option_type: option.option_type,
          price_delta: option.price_delta,
          stock_delta: option.stock_delta,
          is_default: option.is_default,
          is_active: option.is_active,
          sort_order: option.sort_order,
          referenced_sku_id: option.referenced_sku_id ?? undefined,
        })),
      },
    })),
  }
}

export function createProductVariant(isDefault: boolean): ProductVariantForm {
  return {
    sku_name: '',
    price: 0,
    stock_count: 0,
    is_default: isDefault,
    is_active: true,
  }
}

export function createSelectionOption(): SelectionOptionForm {
  return {
    name: '',
    option_type: 'VALUE',
    price_delta: 0,
    stock_delta: 0,
    is_default: false,
    is_active: true,
    sort_order: 0,
  }
}

export function createSelectionBinding(index: number): ProductSelectionBindingForm {
  return {
    scope: 'PRODUCT',
    sort_order: index,
    is_enabled: true,
    group: {
      name: '',
      group_type: 'MODIFIER',
      selection_mode: 'SINGLE',
      min_select: 0,
      max_select: 1,
      is_required: false,
      is_active: true,
      sort_order: index,
      description: '',
      options: [createSelectionOption()],
    },
  }
}

export function normalizeProductConfig(draft: ProductConfigForm): ProductConfigForm {
  const selectedDefaultIndex = draft.variants.findIndex((variant) => variant.is_default)
  const normalizedDefaultIndex = selectedDefaultIndex >= 0 ? selectedDefaultIndex : 0

  return {
    type: draft.type,
    variants: draft.variants.map((variant, index) => ({
      ...variant,
      is_default: index === normalizedDefaultIndex,
    })),
    selection_groups: draft.selection_groups.map((binding, bindingIndex) => ({
      ...binding,
      sort_order: bindingIndex,
      group: {
        ...binding.group,
        sort_order: bindingIndex,
        description: binding.group.description || '',
        options: binding.group.options.map((option, optionIndex) => ({
          ...option,
          sort_order: optionIndex,
        })),
      },
    })),
  }
}
