export type OrderStatus =
  | 'CREATING'
  | 'PENDING_PAYMENT'
  | 'PAID'
  | 'PREPARING'
  | 'READY'
  | 'COMPLETED'
  | 'TIMED_OUT'
  | 'REFUNDING'
  | 'REFUNDED'
  | 'CANCELLED'
  | 'FAILED'
  | 'DELETED'

export type OrderType = 'DINE_IN' | 'TAKEOUT' | 'PICKUP'

export type PaymentChannel =
  | 'CASH'
  | 'WECHAT'
  | 'ALIPAY'
  | 'CUSTOMER_SCAN'
  | 'OTHER'

export type OrderSummaryMetric = {
  label: string
  value: string | number
  note: string
}

export type OrderSummaryResponse = {
  total_count: number
  pending_payment_count: number
  paid_count: number
  refunding_count: number
  refunded_count: number
  total_amount: number
}

export type OrderListItem = {
  id: string
  order_no: string
  store_id: string
  store_name: string
  customer_name: string
  customer_mobile: string
  order_type: OrderType
  status: OrderStatus
  payment_channel: PaymentChannel
  total_amount: number
  payable_amount: number
  remark: string | null
  item_count: number
  item_summary: Array<{
    id: string
    name: string
    sku_name: string | null
    quantity: number
    subtotal: number
  }>
  created_at: string
  updated_at: string
}

export type OrderDetail = {
  id: string
  order_no: string
  store_id: string
  store_name: string
  store_code: string
  customer_name: string
  customer_mobile: string
  order_type: OrderType
  status: OrderStatus
  payment_channel: PaymentChannel
  total_amount: number
  payable_amount: number
  remark: string | null
  is_deleted: boolean
  deleted_at: string | null
  paid_at: string | null
  cancelled_at: string | null
  refunding_at: string | null
  refunded_at: string | null
  created_at: string
  updated_at: string
  items: Array<{
    id: string
    product_id: string
    sku_id: string | null
    product_name: string
    sku_name: string | null
    unit_price: number
    quantity: number
    subtotal: number
    remark: string | null
    selections: Array<{
      id: string
      selection_group_id: string | null
      selection_option_id: string | null
      group_name: string
      option_name: string
      option_type: string
      referenced_sku_id: string | null
      referenced_sku_name: string | null
      price_delta: number
      quantity: number
    }>
  }>
  status_logs: Array<{
    id: string
    from_status: OrderStatus | null
    to_status: OrderStatus
    operator_name: string | null
    note: string | null
    created_at: string
  }>
}

export type OrderFilters = {
  keyword: string
  status: OrderStatus | ''
  orderType: OrderType | ''
  paymentChannel: PaymentChannel | ''
  dateRange: [Date, Date] | []
}

export type OrderStatusAction = {
  label: string
  value: OrderStatus
  type?: 'primary' | 'success' | 'warning' | 'danger' | 'info'
}
