import { requestData } from '@/lib/api'
import { apiUrl } from '@/config/api'
import type {
  ProductConfigForm,
  ProductPage,
  ProductRecord,
  ProductSkuOption,
  ProductStats,
  ProductType,
} from '@/views/products/types'

export type ProductListQuery = {
  page: number
  pageSize: number
  keyword: string
  type: ProductType | ''
}

export function buildProductQuery(query: ProductListQuery): string {
  const params = new URLSearchParams({ page: String(query.page), pageSize: String(query.pageSize) })
  if (query.keyword.trim()) params.set('keyword', query.keyword.trim())
  if (query.type) params.set('type', query.type)
  return params.toString()
}

export function listMerchantProducts(query: ProductListQuery): Promise<ProductPage> {
  return requestData(apiUrl(`/merchant/products?${buildProductQuery(query)}`))
}

export function getMerchantProductStats(): Promise<ProductStats> {
  return requestData(apiUrl('/merchant/products/stats'))
}

export function listMerchantSkuOptions(): Promise<ProductSkuOption[]> {
  return requestData(apiUrl('/merchant/products/sku-options'))
}

export function getMerchantProduct(productId: string): Promise<ProductRecord> {
  return requestData(apiUrl(`/merchant/products/${encodeURIComponent(productId)}`))
}

export function saveMerchantProductConfig(productId: string, payload: ProductConfigForm): Promise<ProductRecord> {
  return requestData(apiUrl(`/merchant/products/${encodeURIComponent(productId)}/config`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function updateMerchantSkuPrice(skuId: string, price: number, expectedVersion: number): Promise<unknown> {
  return requestData(apiUrl('/merchant/sku/update-price'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sku_id: skuId, price, expected_version: expectedVersion }),
  })
}

export function updateMerchantSkuStock(skuId: string, stockCount: number, expectedVersion: number): Promise<unknown> {
  return requestData(apiUrl('/merchant/sku/update-stock'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sku_id: skuId, stock_count: stockCount, expected_version: expectedVersion }),
  })
}

const catalogBase = (storeId: string) => `/merchant/stores/${encodeURIComponent(storeId)}`
function catalogWrite<T>(url: string, body: unknown, method = 'POST'): Promise<T> {
  return requestData(apiUrl(url), {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}
export function merchantCategories(
  storeId: string,
  keyword = '',
  categoryId = '',
  page = 1,
): Promise<import('@lingdian/contracts').MerchantCategoryPage> {
  return requestData(
    apiUrl(
      `${catalogBase(storeId)}/categories?${new URLSearchParams({ page: String(page), pageSize: '50', keyword, ...(categoryId ? { categoryId } : {}) })}`,
    ),
  )
}
export function createMerchantCategory(
  storeId: string,
  name: string,
): Promise<import('@lingdian/contracts').CategoryContract> {
  return catalogWrite(`${catalogBase(storeId)}/categories`, { name })
}
export function createMerchantProduct(
  storeId: string,
  body: import('@lingdian/contracts').CreateMerchantProduct,
): Promise<ProductRecord> {
  return catalogWrite(`${catalogBase(storeId)}/products`, body)
}
export function updateMerchantProductDetails(
  storeId: string,
  id: string,
  body: import('@lingdian/contracts').UpdateMerchantProductDetails,
): Promise<ProductRecord> {
  return catalogWrite(`${catalogBase(storeId)}/products/${encodeURIComponent(id)}/details`, body, 'PATCH')
}
export function updateMerchantProductStatus(
  storeId: string,
  id: string,
  body: import('@lingdian/contracts').UpdateMerchantProductStatus,
): Promise<ProductRecord> {
  return catalogWrite(`${catalogBase(storeId)}/products/${encodeURIComponent(id)}/status`, body, 'PATCH')
}

export function updateMerchantCategory(storeId: string, id: string, body: import('@lingdian/contracts').UpdateMerchantCategory): Promise<import('@lingdian/contracts').MerchantCategoryRecord> {
  return catalogWrite(`${catalogBase(storeId)}/categories/${encodeURIComponent(id)}`, body, 'PATCH')
}
