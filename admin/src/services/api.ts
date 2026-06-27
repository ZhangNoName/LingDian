import type {
  ApiEnvelope,
  CategoryContract as Category,
  OrderSummaryContract as OrderSummary,
  ProductInputContract as ProductInput,
  ProductRecordContract as Product,
  ProductSkuContract as ProductSku,
  ProductStatus,
} from '@lingdian/contracts'

export type { Category, OrderSummary, Product, ProductInput, ProductSku, ProductStatus }

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:3000/api'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...init?.headers,
    },
  })
  const envelope = (await response.json()) as ApiEnvelope<T>

  if (!response.ok || envelope.code !== 0) {
    throw new Error(envelope.msg || '请求失败')
  }

  return envelope.data
}

export function getCategories() {
  return request<Category[]>('/categories')
}

export function createCategory(payload: Pick<Category, 'name'> & Partial<Category>) {
  return request<Category>('/categories', {
    method: 'POST',
    body: JSON.stringify({
      name: payload.name,
      sort_order: payload.sort_order ?? 0,
      is_visible: payload.is_visible ?? true,
    }),
  })
}

export function updateCategory(id: string, payload: Partial<Category>) {
  return request<Category>(`/categories/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      name: payload.name,
      sort_order: payload.sort_order,
      is_visible: payload.is_visible,
    }),
  })
}

export function getProducts() {
  return request<Product[]>('/products')
}

export function createProduct(payload: ProductInput) {
  return request<Product>('/products', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateProduct(id: string, payload: ProductInput) {
  return request<Product>(`/products/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function updateProductStatus(id: string, status: ProductStatus) {
  return request<Product>(`/products/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
}

export function uploadProductImage(file: File) {
  const form = new FormData()
  form.append('file', file)
  return request<{ url: string }>('/uploads/product-image', {
    method: 'POST',
    body: form,
  })
}

export function getOrders() {
  return request<OrderSummary[]>('/orders')
}

export { API_BASE }
