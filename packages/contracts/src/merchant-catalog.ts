import type { CategoryContract, ProductStatus } from './catalog';
export interface MerchantCategoryPage {
  items: CategoryContract[];
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
