import { parseTablePageSize } from '@/components/table/page-size'
import type { LocationQuery } from 'vue-router'
import type { PurchaseDeliveryFilter, PurchaseStatus } from '@lingdian/contracts'
import { dateInput } from '../activity-state'
export interface PurchasingListState {
  keyword: string
  page: number
  pageSize?: number
  status: PurchaseStatus | 'ACTIVE' | 'ALL'
  delivery: PurchaseDeliveryFilter
  expectedBefore: string
}
const orderKeys = ['purchaseKeyword', 'purchasePage', 'purchaseStatus', 'purchaseDelivery', 'purchaseExpectedBefore', 'purchasePageSize']
const supplierKeys = ['supplierKeyword', 'supplierPage', 'supplierPageSize']
export function dateCutoff(day: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error('invalidDelivery')
  const date = new Date(day + 'T00:00:00')
  if (!Number.isFinite(date.getTime()) || dateInput(date) !== day) throw new Error('invalidDelivery')
  return date.toISOString()
}
export function parseListState(
  query: Record<string, unknown>,
  suppliers = false,
  pending = false,
  now = new Date(),
): PurchasingListState {
  const keyword = query[suppliers ? 'supplierKeyword' : 'purchaseKeyword']
  const page = query[suppliers ? 'supplierPage' : 'purchasePage']
  const pageSize = parseTablePageSize(query[suppliers ? 'supplierPageSize' : 'purchasePageSize'])
  const delivery =
    !suppliers && (query.purchaseDelivery === 'BEFORE' || query.purchaseDelivery === 'UNDATED')
      ? query.purchaseDelivery
      : 'ALL'
  const cutoff = query.purchaseExpectedBefore
  let expectedBefore = dateCutoff(dateInput(now))
  if (
    delivery === 'BEFORE' &&
    typeof cutoff === 'string' &&
    /(?:Z|[+-]\d{2}:\d{2})$/.test(cutoff) &&
    Number.isFinite(Date.parse(cutoff))
  ) {
    const day = cutoff.slice(0, 10),
      calendar = new Date(day + 'T00:00:00Z')
    if (Number.isFinite(calendar.getTime()) && calendar.toISOString().slice(0, 10) === day)
      expectedBefore = new Date(cutoff).toISOString()
  }
  return {
    ...(pageSize !== 20 ? { pageSize } : {}),
    keyword: typeof keyword === 'string' ? keyword.trim().slice(0, 120) : '',
    page:
      typeof page === 'string' && /^\d+$/.test(page) && Number(page) >= 1 && Number(page) <= 1000000 ? Number(page) : 1,
    status:
      !suppliers &&
      !pending &&
      delivery === 'ALL' &&
      typeof query.purchaseStatus === 'string' &&
      ['ALL', 'OPEN', 'PARTIAL', 'RECEIVED', 'CANCELLED'].includes(query.purchaseStatus)
        ? (query.purchaseStatus as PurchasingListState['status'])
        : 'ACTIVE',
    delivery,
    expectedBefore,
  }
}
export function listQuery(state: PurchasingListState, suppliers = false): Record<string, string> {
  if (suppliers)
    return {
      ...(state.pageSize && state.pageSize !== 20 ? { supplierPageSize: String(state.pageSize) } : {}),
      ...(state.keyword ? { supplierKeyword: state.keyword } : {}),
      ...(state.page > 1 ? { supplierPage: String(state.page) } : {}),
    }
  return {
    ...(state.pageSize && state.pageSize !== 20 ? { purchasePageSize: String(state.pageSize) } : {}),
    ...(state.keyword ? { purchaseKeyword: state.keyword } : {}),
    ...(state.page > 1 ? { purchasePage: String(state.page) } : {}),
    ...(state.status !== 'ACTIVE' && state.delivery === 'ALL' ? { purchaseStatus: state.status } : {}),
    ...(state.delivery !== 'ALL' ? { purchaseDelivery: state.delivery } : {}),
    ...(state.delivery === 'BEFORE' ? { purchaseExpectedBefore: state.expectedBefore } : {}),
  }
}
export function listTarget(query: LocationQuery, state: PurchasingListState, suppliers = false) {
  const next = { ...query }
  for (const key of suppliers ? supplierKeys : orderKeys) delete next[key]
  return { ...next, ...listQuery(state, suppliers) }
}
export function isCanonicalList(query: Record<string, unknown>, state: PurchasingListState, suppliers = false) {
  const expected = listQuery(state, suppliers)
  return (suppliers ? supplierKeys : orderKeys).every((key) => query[key] === expected[key])
}
/** Non-date edits retain the linked exact cutoff, including sub-day precision. */
export function editedCutoff(state: PurchasingListState, day: string) {
  return dateInput(new Date(state.expectedBefore)) === day ? state.expectedBefore : dateCutoff(day)
}
