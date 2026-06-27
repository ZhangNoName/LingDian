export type ProductStatus = 'DRAFT' | 'ACTIVE' | 'SOLD_OUT' | 'ARCHIVED';
export type ProductType = 'SINGLE' | 'PACKAGE';
export type SelectionScope = 'PRODUCT' | 'VARIANT';
export type SelectionGroupType = 'MODIFIER' | 'COMPONENT';
export type SelectionMode = 'SINGLE' | 'MULTIPLE';
export type SelectionOptionType = 'VALUE' | 'VARIANT';

export type CategoryContract = {
  id: string;
  store_id: string;
  name: string;
  sort_order: number;
  is_visible: boolean;
};

export type ProductSkuContract = {
  id: string;
  product_id: string;
  sku_name: string;
  price: number;
  stock_count: number;
  is_default: boolean;
  is_active: boolean;
};

export type SelectionOptionContract = {
  id: string;
  name: string;
  option_type: SelectionOptionType;
  price_delta: number;
  stock_delta: number;
  is_default: boolean;
  is_active: boolean;
  sort_order: number;
  referenced_sku_id: string | null;
  referenced_sku_name: string | null;
  referenced_product_id: string | null;
  referenced_product_name: string | null;
};

export type ProductSelectionGroupContract = {
  binding_id: string;
  scope: SelectionScope;
  target_variant_id: string | null;
  sort_order: number;
  is_enabled: boolean;
  group: {
    id: string;
    name: string;
    group_type: SelectionGroupType;
    selection_mode: SelectionMode;
    min_select: number;
    max_select: number;
    is_required: boolean;
    is_active: boolean;
    sort_order: number;
    description: string | null;
    options: SelectionOptionContract[];
  };
};

export type ProductRecordContract = {
  id: string;
  store_id: string;
  category_id: string;
  category: string;
  name: string;
  description: string | null;
  image_url: string | null;
  type: ProductType;
  price: number;
  stock: number;
  status: ProductStatus;
  is_active: boolean;
  is_featured: boolean;
  skus: ProductSkuContract[];
  selection_groups: ProductSelectionGroupContract[];
};

export type ProductInputContract = {
  category_id: string;
  name: string;
  description?: string;
  image_url?: string;
  price: number;
  stock?: number;
  is_featured?: boolean;
  status?: ProductStatus;
};

export type MenuContract = {
  store: {
    id: string;
    code?: string;
    name: string;
    status: string;
    businessHours?: string | null;
    dineInEnabled?: boolean;
    takeoutEnabled?: boolean;
    pickupEnabled?: boolean;
  };
  categories: Array<{
    id: string;
    name: string;
    sort_order: number;
    products: ProductRecordContract[];
  }>;
};

export type ProductConfigVariantContract = {
  id?: string;
  sku_name: string;
  price: number;
  stock_count: number;
  is_default: boolean;
  is_active: boolean;
};

export type ProductConfigSelectionOptionContract = {
  id?: string;
  name: string;
  option_type: SelectionOptionType;
  price_delta: number;
  stock_delta: number;
  is_default: boolean;
  is_active: boolean;
  sort_order: number;
  referenced_sku_id?: string;
};

export type ProductConfigSelectionGroupContract = {
  id?: string;
  name: string;
  group_type: SelectionGroupType;
  selection_mode: SelectionMode;
  min_select: number;
  max_select: number;
  is_required: boolean;
  is_active: boolean;
  sort_order: number;
  description: string;
  options: ProductConfigSelectionOptionContract[];
};

export type ProductConfigSelectionBindingContract = {
  id?: string;
  scope: SelectionScope;
  target_variant_id?: string;
  sort_order: number;
  is_enabled: boolean;
  group: ProductConfigSelectionGroupContract;
};

export type ProductConfigContract = {
  type: ProductType;
  variants: ProductConfigVariantContract[];
  selection_groups: ProductConfigSelectionBindingContract[];
};
