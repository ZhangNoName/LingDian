import { defaultActivityState, parseActivityState } from '../activity-state'
import type { PurchaseReportFilter } from '@lingdian/contracts'
export function receiptState(query: Record<string, unknown>, now = new Date()): PurchaseReportFilter {
  const defaults = defaultActivityState(now),
    parsed = parseActivityState(
      {
        startAt: query.receiptStartAt,
        endAt: query.receiptEndAt,
        keyword: query.receiptKeyword,
        itemId: query.receiptItemId,
      },
      now,
    )
  return {
    startAt: parsed.startAt || defaults.startAt,
    endAt: parsed.endAt || defaults.endAt,
    ...(parsed.keyword ? { keyword: parsed.keyword } : {}),
    ...(parsed.itemId ? { itemId: parsed.itemId } : {}),
    ...(typeof query.receiptSupplierId === 'string' &&
    query.receiptSupplierId.trim() &&
    query.receiptSupplierId.length <= 191
      ? { supplierId: query.receiptSupplierId.trim() }
      : {}),
  }
}
export function receiptQuery(state: PurchaseReportFilter): Record<string, string> {
  return {
    receiptStartAt: state.startAt,
    receiptEndAt: state.endAt,
    ...(state.keyword ? { receiptKeyword: state.keyword } : {}),
    ...(state.itemId ? { receiptItemId: state.itemId } : {}),
    ...(state.supplierId ? { receiptSupplierId: state.supplierId } : {}),
  }
}
