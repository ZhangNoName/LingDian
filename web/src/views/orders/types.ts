import type {
  OrderDetailContract,
  OrderPageContract,
  OrderSource as ContractOrderSource,
  OrderStatus as ContractOrderStatus,
  OrderSummaryContract,
  OrderSummaryStatsContract,
  OrderType as ContractOrderType,
  PaymentChannel as ContractPaymentChannel,
} from '@lingdian/contracts'

export type OrderStatus = ContractOrderStatus
export type OrderType = ContractOrderType
export type OrderSource = ContractOrderSource
export type PaymentChannel = ContractPaymentChannel

export type OrderSummaryMetric = {
  label: string
  value: string | number
  note: string
}

export type OrderSummaryResponse = OrderSummaryStatsContract

// Historical rows can predate the order-source migration even though new API
// records always satisfy the shared contract.
export type OrderListItem = Omit<OrderSummaryContract, 'order_source'> & {
  order_source: OrderSource | null
}

export type OrderPageResponse = Omit<OrderPageContract, 'items'> & {
  items: OrderListItem[]
}

export type OrderDetail = Omit<OrderDetailContract, 'order_source'> & {
  order_source: OrderSource | null
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
