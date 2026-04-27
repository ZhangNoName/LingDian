type ProductRecord = {
  id: string;
  storeId: string;
  name: string;
  description: string | null;
  type: string;
  status: string;
  categoryId: string;
  category: { id: string; name: string } | null;
  skus: Array<{
    id: string;
    productId: string;
    skuName: string;
    price: number | { toString(): string };
    stockCount: number;
    isDefault: boolean;
    isActive: boolean;
    selectionBindings: Array<{
      id: string;
      scope: string;
      sortOrder: number;
      isEnabled: boolean;
      variantId: string | null;
      group: ProductRecord['selectionBindings'][number]['group'];
    }>;
  }>;
  selectionBindings: Array<{
    id: string;
    scope: string;
    sortOrder: number;
    isEnabled: boolean;
    variantId: string | null;
    group: {
      id: string;
      name: string;
      groupType: string;
      selectionMode: string;
      minSelect: number;
      maxSelect: number;
      isRequired: boolean;
      isActive: boolean;
      sortOrder: number;
      description: string | null;
      options: Array<{
        id: string;
        name: string;
        optionType: string;
        priceDelta: number | { toString(): string };
        stockDelta: number;
        isDefault: boolean;
        isActive: boolean;
        sortOrder: number;
        referencedSkuId: string | null;
        referencedSku: null | {
          id: string;
          skuName: string;
          product: {
            id: string;
            name: string;
          };
        };
      }>;
    };
  }>;
};

function toNumber(value: number | { toString(): string }) {
  return Number(value);
}

export function mapProductRecord(product: ProductRecord) {
  const productBindings = product.selectionBindings.map((binding) => ({
    binding_id: binding.id,
    scope: binding.scope,
    target_variant_id: binding.variantId,
    sort_order: binding.sortOrder,
    is_enabled: binding.isEnabled,
    group: {
      id: binding.group.id,
      name: binding.group.name,
      group_type: binding.group.groupType,
      selection_mode: binding.group.selectionMode,
      min_select: binding.group.minSelect,
      max_select: binding.group.maxSelect,
      is_required: binding.group.isRequired,
      is_active: binding.group.isActive,
      sort_order: binding.group.sortOrder,
      description: binding.group.description,
      options: binding.group.options.map((option) => ({
        id: option.id,
        name: option.name,
        option_type: option.optionType,
        price_delta: toNumber(option.priceDelta),
        stock_delta: option.stockDelta,
        is_default: option.isDefault,
        is_active: option.isActive,
        sort_order: option.sortOrder,
        referenced_sku_id: option.referencedSkuId,
        referenced_sku_name: option.referencedSku?.skuName ?? null,
        referenced_product_id: option.referencedSku?.product.id ?? null,
        referenced_product_name: option.referencedSku?.product.name ?? null,
      })),
    },
  }));
  const variantBindings = product.skus.flatMap((sku) =>
    sku.selectionBindings.map((binding) => ({
      binding_id: binding.id,
      scope: binding.scope,
      target_variant_id: binding.variantId ?? sku.id,
      sort_order: binding.sortOrder,
      is_enabled: binding.isEnabled,
      group: {
        id: binding.group.id,
        name: binding.group.name,
        group_type: binding.group.groupType,
        selection_mode: binding.group.selectionMode,
        min_select: binding.group.minSelect,
        max_select: binding.group.maxSelect,
        is_required: binding.group.isRequired,
        is_active: binding.group.isActive,
        sort_order: binding.group.sortOrder,
        description: binding.group.description,
        options: binding.group.options.map((option) => ({
          id: option.id,
          name: option.name,
          option_type: option.optionType,
          price_delta: toNumber(option.priceDelta),
          stock_delta: option.stockDelta,
          is_default: option.isDefault,
          is_active: option.isActive,
          sort_order: option.sortOrder,
          referenced_sku_id: option.referencedSkuId,
          referenced_sku_name: option.referencedSku?.skuName ?? null,
          referenced_product_id: option.referencedSku?.product.id ?? null,
          referenced_product_name: option.referencedSku?.product.name ?? null,
        })),
      },
    })),
  );

  return {
    id: product.id,
    store_id: product.storeId,
    name: product.name,
    description: product.description,
    type: product.type,
    is_active: product.status === 'ACTIVE',
    status: product.status,
    category: product.category?.name ?? '',
    category_id: product.categoryId,
    skus: product.skus.map((sku) => ({
      id: sku.id,
      product_id: sku.productId,
      sku_name: sku.skuName,
      price: toNumber(sku.price),
      stock_count: sku.stockCount,
      is_default: sku.isDefault,
      is_active: sku.isActive,
    })),
    selection_groups: [...productBindings, ...variantBindings].sort(
      (left, right) => left.sort_order - right.sort_order,
    ),
  };
}
