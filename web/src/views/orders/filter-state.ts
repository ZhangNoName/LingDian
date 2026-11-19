import { extendedTablePageSizes, parseTablePageSize } from '@/components/table/page-size'
import { statusOptions, orderTypeOptions, paymentChannelOptions } from './order-presentation'
import { periodFromDates, dateInput } from '@/views/warehouse/activity-state'
import type { OrderStatus, OrderType, PaymentChannel } from './types'
export { dateInput }
export interface OrderFilterState { keyword: string; status: OrderStatus | ''; orderType: OrderType | ''; paymentChannel: PaymentChannel | ''; startAt: string; endAt: string; page: number; pageSize: number; orderId: string }
export function parseOrderState(query: Record<string, unknown>): OrderFilterState {
  const text = (value: unknown, max: number) => typeof value === 'string' ? value.trim().slice(0, max) : ''
  const instant = (value: unknown) => typeof value === 'string' && /(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : ''
  const startAt = instant(query.startAt), endAt = instant(query.endAt)
  const validPeriod = startAt && endAt && Date.parse(startAt) < Date.parse(endAt) && Date.parse(endAt) - Date.parse(startAt) <= 366 * 86400000
  return { keyword: text(query.keyword, 120), status: statusOptions.some(option => option.value === query.status) ? query.status as OrderStatus : '', orderType: orderTypeOptions.some(option => option.value === query.orderType) ? query.orderType as OrderType : '', paymentChannel: paymentChannelOptions.some(option => option.value === query.paymentChannel) ? query.paymentChannel as PaymentChannel : '', startAt: validPeriod ? startAt : '', endAt: validPeriod ? endAt : '', page: /^\d+$/.test(String(query.page)) && Number(query.page) >= 1 && Number(query.page) <= 1000000 ? Number(query.page) : 1, pageSize: parseTablePageSize(query.pageSize, 20, extendedTablePageSizes), orderId: text(query.orderId, 191) }
}
export function orderStateQuery(state: OrderFilterState): Record<string, string> {
  const query: Record<string, string> = {}
  for (const key of ['keyword', 'status', 'orderType', 'paymentChannel', 'startAt', 'endAt', 'orderId'] as const) if (state[key]) query[key] = state[key]
  if (state.page > 1) query.page = String(state.page)
  if (state.pageSize !== 20) query.pageSize = String(state.pageSize)
  return query
}
export function orderPeriodFromDates(from: string, to: string) { return !from && !to ? { startAt: '', endAt: '' } : periodFromDates(from, to) }
export function orderListFingerprint(state: OrderFilterState) { const { orderId: _orderId, ...list } = state; return JSON.stringify(list) }
/** Keep shared exact instants when only non-date filters change, even across viewer timezones. */
export function orderPeriodForDraft(state: Pick<OrderFilterState, 'startAt' | 'endAt'>, from: string, to: string) {
  const unchanged = from === (state.startAt ? dateInput(new Date(state.startAt)) : '') && to === (state.endAt ? dateInput(new Date(Date.parse(state.endAt) - 1)) : '')
  return unchanged ? { startAt: state.startAt, endAt: state.endAt } : orderPeriodFromDates(from, to)
}
