import type { CategoryContract, ProductStatus } from './catalog';
export interface MerchantCategoryPage {
  items: MerchantCategoryRecord[];
  total: number;
  page: number;
  pageSize: number;
}
export interface CreateMerchantProduct {
  requestId: string;
  category_id: string;
  name: string;
  description: string;
  price: number;
  sku_name: string;
  is_featured: boolean;
}
export interface UpdateMerchantProductDetails {
  expected_version: number;
  category_id: string;
  name: string;
  description: string;
  is_featured: boolean;
}
export interface UpdateMerchantProductStatus {
  expected_version: number;
  status: ProductStatus;
}

export interface MerchantCategoryRecord extends CategoryContract {
  configuration_version: number;
  product_count: number;
  active_product_count: number;
}
export interface UpdateMerchantCategory {
  expected_version: number;
  name: string;
  sort_order: number;
  is_visible: boolean;
}
