const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:3000/api'

type ApiEnvelope<T> = {
  code: number
  msg: string
  data: T
}

export type Category = {
  id: string
  store_id: string
  name: string
  sort_order: number
  is_visible: boolean
}

export type ProductStatus = 'DRAFT' | 'ACTIVE' | 'SOLD_OUT' | 'ARCHIVED'

export type ProductSku = {
  id: string
  product_id: string
  sku_name: string
  price: number
  stock_count: number
  is_default: boolean
  is_active: boolean
}

export type Product = {
  id: string
  store_id: string
  category_id: string
  category: string
  name: string
  description: string | null
  image_url: string | null
  price: number
  stock: number
  status: ProductStatus
  is_active: boolean
  is_featured: boolean
  skus: ProductSku[]
}

export type ProductInput = {
  category_id: string
  name: string
  description?: string
  image_url?: string
  price: number
  stock?: number
  is_featured?: boolean
  status?: ProductStatus
}

export type OrderSummary = {
  id: string
  order_no: string
  store_name: string
  customer_name: string
  customer_mobile: string
  order_type: string
  status: string
  payable_amount: number
  item_count: number
  item_summary: Array<{
    id: string
    name: string
    sku_name: string | null
    quantity: number
    subtotal: number
  }>
  created_at: string
}

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

