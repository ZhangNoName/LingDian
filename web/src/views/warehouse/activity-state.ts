import type { InventoryMovementKind } from '@lingdian/contracts'

export interface ActivityState { startAt: string; endAt: string; keyword: string; itemId: string; kind: InventoryMovementKind | ''; page: number }
export const movementKinds: InventoryMovementKind[] = ['RECEIVE', 'ISSUE', 'LOSS', 'COUNT', 'THRESHOLD']
export function dateInput(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
}
export function periodFromDates(from: string, to: string): { startAt: string; endAt: string } {
  const parse = (text: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error('inventory.invalidPeriod')
    const date = new Date(`${text}T00:00:00`)
    if (!Number.isFinite(date.getTime()) || dateInput(date) !== text) throw new Error('inventory.invalidPeriod')
    return date
  }
  const start = parse(from), end = parse(to)
  end.setDate(end.getDate() + 1)
  if (start >= end || end.getTime() - start.getTime() > 366 * 86400000) throw new Error('inventory.invalidPeriod')
  return { startAt: start.toISOString(), endAt: end.toISOString() }
}
export function defaultActivityState(now = new Date()): ActivityState {
  const from = new Date(now)
  from.setDate(from.getDate() - 29)
  return { ...periodFromDates(dateInput(from), dateInput(now)), keyword: '', itemId: '', kind: '', page: 1 }
}
export function parseActivityState(query: Record<string, unknown>, now = new Date()): ActivityState {
  const defaults = defaultActivityState(now)
  const instant = (value: unknown, fallback: string) => typeof value === 'string' && /(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : fallback
  const startAt = instant(query.startAt, defaults.startAt), endAt = instant(query.endAt, defaults.endAt)
  const validPeriod = Date.parse(startAt) < Date.parse(endAt) && Date.parse(endAt) - Date.parse(startAt) <= 366 * 86400000
  return {
    startAt: validPeriod ? startAt : defaults.startAt, endAt: validPeriod ? endAt : defaults.endAt,
    keyword: typeof query.keyword === 'string' ? query.keyword.trim().slice(0, 120) : '',
    itemId: typeof query.itemId === 'string' ? query.itemId.slice(0, 191) : '',
    kind: movementKinds.includes(query.kind as InventoryMovementKind) ? query.kind as InventoryMovementKind : '',
    page: /^\d+$/.test(String(query.page)) && Number(query.page) >= 1 && Number(query.page) <= 1000000 ? Number(query.page) : 1,
  }
}
export function activityQuery(state: ActivityState): Record<string, string> {
  return { startAt: state.startAt, endAt: state.endAt, ...(state.keyword ? { keyword: state.keyword } : {}), ...(state.itemId ? { itemId: state.itemId } : {}), ...(state.kind ? { kind: state.kind } : {}), ...(state.page > 1 ? { page: String(state.page) } : {}) }
}
