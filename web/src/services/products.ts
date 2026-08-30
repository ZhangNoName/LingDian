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

export function updateMerchantSkuPrice(skuId: string, price: number): Promise<unknown> {
  return requestData(apiUrl('/merchant/sku/update-price'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sku_id: skuId, price }),
  })
}

export function updateMerchantSkuStock(skuId: string, stockCount: number): Promise<unknown> {
  return requestData(apiUrl('/merchant/sku/update-stock'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sku_id: skuId, stock_count: stockCount }),
  })
}
