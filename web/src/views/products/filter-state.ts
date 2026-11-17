import type { ProductType } from './types'
export interface ProductFilterState {
  keyword: string
  type: ProductType | ''
  page: number
  pageSize: number
  productId: string
}
export function parseProductState(query: Record<string, unknown>): ProductFilterState {
  return {
    keyword: typeof query.keyword === 'string' ? query.keyword.trim().slice(0, 120) : '',
    type: typeof query.type === 'string' && ['SINGLE', 'PACKAGE'].includes(query.type) ? (query.type as ProductType) : '',
    page:
      /^\d+$/.test(String(query.page)) && Number(query.page) > 0 && Number(query.page) <= 1000000
        ? Number(query.page)
        : 1,
    pageSize: [20, 50, 100].includes(Number(query.pageSize)) ? Number(query.pageSize) : 20,
    productId: typeof query.productId === 'string' && query.productId.length <= 191 ? query.productId.trim() : '',
  }
}
export function productStateQuery(state: ProductFilterState): Record<string, string> {
  return {
    ...(state.keyword ? { keyword: state.keyword } : {}),
    ...(state.type ? { type: state.type } : {}),
    ...(state.page > 1 ? { page: String(state.page) } : {}),
    ...(state.pageSize !== 20 ? { pageSize: String(state.pageSize) } : {}),
    ...(state.productId ? { productId: state.productId } : {}),
  }
}
export function productListKey(state: ProductFilterState) {
  const { productId: _productId, ...list } = state
  return JSON.stringify(list)
}
