export type PaymentMethod = 'cash' | 'alipay' | 'wechat'

export type OrderType = 'dine_in' | 'takeout' | 'pickup'

export type BadgeVariant = 'secondary' | 'outline' | 'destructive'

export type Product = {
  id: string
  skuId: string
  storeId: string
  productId: string
  name: string
  description: string
  category: string
  price: number
  stock: number
  tag: string
  badgeVariant: BadgeVariant
}

export type CartItem = Product & {
  quantity: number
}

export type DiningTable = {
  id: string
  label: string
  area: string
  seats: number
  occupied: boolean
}

export type MemberProfile = {
  name: string
  level: string
  discountRate: number
}

export type Coupon = {
  code: string
  label: string
  discountAmount: number
}

export type OrderMode = {
  label: string
  value: OrderType
}

export type PaymentOption = {
  label: string
  value: PaymentMethod
}

export type OrderForm = {
  orderType: OrderType
  guestCount: number
  cashier: string
  storeName: string
  remark: string
}

export type ProductApiSku = {
  id: string
  product_id: string
  sku_name: string
  price: number
  stock_count: number
}

export type ProductApiItem = {
  id: string
  store_id: string
  name: string
  description?: string
  is_active: boolean
  status: string
  category: string
  category_id: string
  skus: ProductApiSku[]
}
