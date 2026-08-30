import { requestData } from '@/lib/api'
import { apiUrl } from '@/config/api'
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

  if (query.dateRange.length === 2) {
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

export function updateMerchantOrderStatus(
  orderId: string,
  status: OrderStatus,
  note?: string,
): Promise<OrderDetail> {
  return requestData(apiUrl(`/merchant/orders/${encodeURIComponent(orderId)}/status`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, operatorName: '订单后台', note: note || undefined }),
  })
}

export function deleteMerchantOrder(orderId: string): Promise<OrderDetail> {
  const query = new URLSearchParams({ operatorName: '订单后台' })
  return requestData(apiUrl(`/merchant/orders/${encodeURIComponent(orderId)}?${query}`), {
    method: 'DELETE',
  })
}
