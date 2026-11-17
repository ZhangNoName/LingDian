import type { LocationQuery } from 'vue-router'
import type { InventoryLifecycle, InventoryStatus } from '@lingdian/contracts'
import { activityQuery, defaultActivityState } from '../activity-state'
export interface StockState {
  keyword: string
  status: InventoryStatus | ''
  lifecycle: InventoryLifecycle
  page: number
}
const keys = ['stockKeyword', 'stockStatus', 'stockPage', 'inventoryLifecycle', 'materialId']
export function materialRecordId(value: unknown): string {
  return typeof value === 'string' && value.trim().length <= 191 && !/[\x00-\x1f\x7f]/.test(value)
    ? value.trim()
    : ''
}
export function parseStockState(query: Record<string, unknown>): StockState {
  const lifecycle =
    query.inventoryLifecycle === 'ARCHIVED' || query.inventoryLifecycle === 'ALL'
      ? query.inventoryLifecycle
      : 'ACTIVE'
  return {
    keyword: typeof query.stockKeyword === 'string' ? query.stockKeyword.trim().slice(0, 120) : '',
    status:
      lifecycle !== 'ARCHIVED' &&
      typeof query.stockStatus === 'string' &&
      ['LOW', 'OUT', 'HEALTHY'].includes(query.stockStatus)
        ? (query.stockStatus as InventoryStatus)
        : '',
    lifecycle,
    page:
      typeof query.stockPage === 'string' &&
      /^\d+$/.test(query.stockPage) &&
      Number(query.stockPage) >= 1 &&
      Number(query.stockPage) <= 1000000
        ? Number(query.stockPage)
        : 1,
  }
}
export function stockQuery(state: StockState, id = ''): Record<string, string> {
  return {
    ...(state.keyword ? { stockKeyword: state.keyword } : {}),
    ...(state.status && state.lifecycle !== 'ARCHIVED' ? { stockStatus: state.status } : {}),
    ...(state.page > 1 ? { stockPage: String(state.page) } : {}),
    ...(state.lifecycle !== 'ACTIVE' ? { inventoryLifecycle: state.lifecycle } : {}),
    ...(id ? { materialId: id } : {}),
  }
}
export function stockTarget(query: LocationQuery, state: StockState, id = '') {
  const next = { ...query }
  for (const key of keys) delete next[key]
  return { ...next, ...stockQuery(state, id) }
}
export function canonicalStock(query: Record<string, unknown>, state: StockState, id: string) {
  const expected = stockQuery(state, id)
  return keys.every((key) => query[key] === expected[key])
}
/** Only stock-list and source-material context cross into history/report URLs. Never carry tenant ids. */
export function inventoryNavigationContext(query: Record<string, unknown>): Record<string, string> {
  return stockQuery(parseStockState(query), materialRecordId(query.materialId))
}
export function materialActivityTarget(
  query: Record<string, unknown>,
  id: string,
  mode: 'history' | 'report',
  now = new Date(),
): Record<string, string> {
  return {
    view: mode,
    ...inventoryNavigationContext({ ...query, materialId: id }),
    ...activityQuery({ ...defaultActivityState(now), itemId: id }),
  }
}
export function returnMaterialTarget(query: Record<string, unknown>) {
  return { view: 'inventory', ...inventoryNavigationContext(query) }
}
