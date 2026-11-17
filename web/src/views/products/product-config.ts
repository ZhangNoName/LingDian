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
    expected_version: product.configuration_version,
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
    id: `draft_${crypto.randomUUID()}`,
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
  const selectedDefaultIndex = draft.variants.findIndex((variant) => variant.is_default && variant.is_active)
  const normalizedDefaultIndex =
    selectedDefaultIndex >= 0
      ? selectedDefaultIndex
      : Math.max(
          0,
          draft.variants.findIndex((variant) => variant.is_active),
        )

  return {
    type: draft.type,
    ...(draft.expected_version !== undefined ? { expected_version: draft.expected_version } : {}),
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

export function validateProductConfig(
  draft: ProductConfigForm,
):
  | 'nameRequired'
  | 'numericInvalid'
  | 'rulesInvalid'
  | 'optionsInsufficient'
  | 'referenceRequired'
  | 'variantRequired'
  | undefined {
  if (!draft.variants.length) return 'variantRequired'
  const money = (value: number) =>
    typeof value === 'number' &&
    Number.isFinite(value) &&
    Number(value) >= 0 &&
    Number(value) <= 99999999.99 &&
    Math.abs(Number(value) * 100 - Math.round(Number(value) * 100)) < 0.00001
  for (const variant of draft.variants) {
    if (!variant.sku_name.trim()) return 'nameRequired'
    if (
      !money(variant.price) ||
      !Number.isInteger(variant.stock_count) ||
      Number(variant.stock_count) < 0 ||
      Number(variant.stock_count) > 999999
    )
      return 'numericInvalid'
  }
  const ids = new Set(draft.variants.map((variant) => variant.id))
  for (const binding of draft.selection_groups) {
    const group = binding.group
    if (!group.name.trim() || group.options.some((option) => !option.name.trim())) return 'nameRequired'
    if (binding.scope === 'VARIANT' && !ids.has(binding.target_variant_id)) return 'referenceRequired'
    if (![group.min_select, group.max_select].every((value) => Number.isInteger(value) && value >= 0 && value <= 50))
      return 'numericInvalid'
    if (
      (group.is_required && group.max_select < 1) ||
      group.min_select > group.max_select ||
      (group.selection_mode === 'SINGLE' && group.max_select > 1)
    )
      return 'rulesInvalid'
    if (
      binding.is_enabled &&
      group.is_active &&
      group.options.filter((option) => option.is_active).length < Math.max(group.min_select, group.is_required ? 1 : 0)
    )
      return 'optionsInsufficient'
    for (const option of group.options) {
      if (!money(option.price_delta)) return 'numericInvalid'
      if (option.option_type === 'VARIANT' && !option.referenced_sku_id) return 'referenceRequired'
    }
  }
}
