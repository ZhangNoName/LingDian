import { parseTablePageSize } from '@/components/table/page-size'
import type { LocationQuery } from 'vue-router'
export interface AlertState {
  status: 'ACTIVE' | 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' | 'ALL'
  severity: '' | 'LOW' | 'OUT'
  keyword: string
  page: number
  pageSize?: number
}
const keys = ['alertStatus', 'alertSeverity', 'alertKeyword', 'alertPage', 'alertId', 'alertPageSize']
export function alertId(value: unknown): string {
  return typeof value === 'string' && value.trim().length <= 191 && !/[\x00-\x1f\x7f]/.test(value)
    ? value.trim()
    : ''
}
export function parseAlertState(query: Record<string, unknown>): AlertState {
  const pageSize = parseTablePageSize(query.alertPageSize)
  return {
    ...(pageSize !== 20 ? { pageSize } : {}),
    status:
      typeof query.alertStatus === 'string' &&
      ['OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'ALL'].includes(query.alertStatus)
        ? (query.alertStatus as AlertState['status'])
        : 'ACTIVE',
    severity: query.alertSeverity === 'LOW' || query.alertSeverity === 'OUT' ? query.alertSeverity : '',
    keyword: typeof query.alertKeyword === 'string' ? query.alertKeyword.trim().slice(0, 120) : '',
    page:
      typeof query.alertPage === 'string' &&
      /^\d+$/.test(query.alertPage) &&
      Number(query.alertPage) >= 1 &&
      Number(query.alertPage) <= 1000000
        ? Number(query.alertPage)
        : 1,
  }
}
export function alertQuery(state: AlertState, id = ''): Record<string, string> {
  return {
    ...(state.pageSize && state.pageSize !== 20 ? { alertPageSize: String(state.pageSize) } : {}),
    ...(state.status !== 'ACTIVE' ? { alertStatus: state.status } : {}),
    ...(state.severity ? { alertSeverity: state.severity } : {}),
    ...(state.keyword ? { alertKeyword: state.keyword } : {}),
    ...(state.page > 1 ? { alertPage: String(state.page) } : {}),
    ...(id ? { alertId: id } : {}),
  }
}
export function alertTarget(query: LocationQuery, state: AlertState, id = '') {
  const next = { ...query }
  for (const key of keys) delete next[key]
  return { ...next, ...alertQuery(state, id) }
}
export function canonicalAlerts(query: Record<string, unknown>, state: AlertState, id: string) {
  const expected = alertQuery(state, id)
  return keys.every((key) => query[key] === expected[key])
}
