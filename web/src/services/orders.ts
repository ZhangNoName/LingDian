import { requestData } from '@/lib/api'
import { apiUrl } from '@/config/api'
import type { MerchantWechatNativePayment } from '@lingdian/contracts'
import type {
  OrderDetail,
  OrderFilters,
  OrderPageResponse,
  OrderStatus,
  OrderSummaryResponse,
} from '@/views/orders/types'

export type OrderListQuery = OrderFilters & {
  page: number
  pageSize: number
  startAt?: string
  endAt?: string
}

export function buildOrderQuery(query: OrderListQuery, includePagination = true): string {
  const params = new URLSearchParams()
  if (includePagination) {
    params.set('page', String(query.page))
    params.set('pageSize', String(query.pageSize))
  }
  if (query.keyword.trim()) params.set('keyword', query.keyword.trim())
  if (query.status) params.set('status', query.status)
  if (query.orderType) params.set('orderType', query.orderType)
  if (query.paymentChannel) params.set('paymentChannel', query.paymentChannel)

  if (query.startAt && query.endAt) {
    params.set('startDate', query.startAt)
    params.set('endBefore', query.endAt)
  } else if (query.dateRange.length === 2) {
    const [start, end] = query.dateRange
    const startDate = new Date(start)
    const endDate = new Date(end)
    startDate.setHours(0, 0, 0, 0)
    endDate.setHours(23, 59, 59, 999)
    params.set('startDate', startDate.toISOString())
    params.set('endDate', endDate.toISOString())
  }

  return params.toString()
}

export function listMerchantOrders(query: OrderListQuery): Promise<OrderPageResponse> {
  return requestData(apiUrl(`/merchant/orders?${buildOrderQuery(query)}`))
}

export function summarizeMerchantOrders(query: OrderListQuery): Promise<OrderSummaryResponse> {
  const search = buildOrderQuery(query, false)
  return requestData(apiUrl(`/merchant/orders/summary${search ? `?${search}` : ''}`))
}

export function getMerchantOrder(orderId: string): Promise<OrderDetail> {
  return requestData(apiUrl(`/merchant/orders/${encodeURIComponent(orderId)}`))
}

export function getMerchantWechatNativePayment(orderId: string): Promise<MerchantWechatNativePayment> {
  return requestData(apiUrl(`/merchant/orders/${encodeURIComponent(orderId)}/wechat-native-payment`))
}

export function createMerchantWechatNativePayment(orderId: string): Promise<MerchantWechatNativePayment> {
  return requestData(apiUrl(`/merchant/orders/${encodeURIComponent(orderId)}/wechat-native-payment`), { method: 'POST' })
}

export function updateMerchantOrderStatus(
  order: Pick<OrderDetail, 'id' | 'status' | 'payment_channel'>,
  status: OrderStatus,
  note?: string,
): Promise<OrderDetail> {
  return requestData(apiUrl(`/merchant/orders/${encodeURIComponent(order.id)}/status`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status,
      expectedStatus: order.status,
      expectedPaymentChannel: order.payment_channel,
      note: note || undefined,
    }),
  })
}

export function deleteMerchantOrder(orderId: string): Promise<OrderDetail> {
  return requestData(apiUrl(`/merchant/orders/${encodeURIComponent(orderId)}`), {
    method: 'DELETE',
  })
}
