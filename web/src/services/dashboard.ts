import type { MerchantDashboardSnapshot, StockHoldDetail, StockHoldPage, StockHoldRecheckResult } from '@lingdian/contracts'
import { apiUrl } from '@/config/api'
import { requestData } from '@/lib/api'
export function getMerchantDashboard(period: { startAt: string; endAt: string }): Promise<MerchantDashboardSnapshot> {
  return requestData(apiUrl(`/merchant/dashboard?${new URLSearchParams(period)}`))
}
export function listStockHolds(page: number, state: 'EXPIRED' | 'ALL', keyword = '', pageSize = 20): Promise<StockHoldPage> {
  return requestData(apiUrl(`/merchant/stock-holds?${new URLSearchParams({ page: String(page), pageSize: String(pageSize), state, keyword })}`))
}
export function getStockHold(orderId: string, page = 1, pageSize = 20): Promise<StockHoldDetail> {
  return requestData(apiUrl(`/merchant/stock-holds/${encodeURIComponent(orderId)}?${new URLSearchParams({ page: String(page), pageSize: String(pageSize) })}`))
}
export function recheckStockHold(orderId: string): Promise<StockHoldRecheckResult> {
  return requestData(apiUrl(`/merchant/stock-holds/${encodeURIComponent(orderId)}/recheck`), { method: 'POST' })
}
