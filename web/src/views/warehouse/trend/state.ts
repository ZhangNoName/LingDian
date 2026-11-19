import { parseTablePageSize } from '@/components/table/page-size'
import type { LocationQuery } from 'vue-router'
import type { InventoryTrendDay } from '@lingdian/contracts'
import { activityQuery, parseActivityState, type ActivityState } from '../activity-state'
import { inventoryNavigationContext, materialRecordId } from '../materials/state'
export interface TrendView {
  timeZone: string
  day: string
  page: number
  pageSize?: number
}
export function zone(value: unknown, fallback = Intl.DateTimeFormat().resolvedOptions().timeZone) {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: typeof value === 'string' && value.length <= 100 ? value : fallback,
    }).resolvedOptions().timeZone
  } catch {
    return fallback
  }
}
export function zonedDate(instant: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(instant))
  const value = (key: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === key)?.value ?? ''
  return `${value('year')}-${value('month')}-${value('day')}`
}
export function dayKey(value: unknown) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return ''
  const day = new Date(value + 'T00:00:00Z')
  return Number.isFinite(day.getTime()) && day.toISOString().slice(0, 10) === value ? value : ''
}
export function parseTrendView(query: Record<string, unknown>, fallback?: string): TrendView {
  const page = query.trendPage
  const pageSize = parseTablePageSize(query.trendPageSize)
  return {
    ...(pageSize !== 20 ? { pageSize } : {}),
    timeZone: zone(query.trendZone, fallback),
    day: dayKey(query.trendDay),
    page:
      typeof page === 'string' && /^\d+$/.test(page) && Number(page) >= 1 && Number(page) <= 1000000
        ? Number(page)
        : 1,
  }
}
export function trendQuery(view: TrendView): Record<string, string> {
  return {
    trendZone: view.timeZone,
    ...(view.pageSize && view.pageSize !== 20 ? { trendPageSize: String(view.pageSize) } : {}),
    ...(view.day ? { trendDay: view.day } : {}),
    ...(view.page > 1 ? { trendPage: String(view.page) } : {}),
  }
}
export function trendTarget(
  query: Record<string, unknown>,
  state: ActivityState,
  itemId = state.itemId,
  view = parseTrendView(query),
) {
  return {
    view: 'report',
    ...inventoryNavigationContext(query),
    ...activityQuery({ ...state, itemId, keyword: '', kind: '', page: 1 }),
    reportView: 'trend',
    ...trendQuery(view),
  }
}
export function selectionTarget(query: LocationQuery, view: TrendView) {
  const next = { ...query }
  for (const key of ['trendZone', 'trendDay', 'trendPage', 'trendPageSize']) delete next[key]
  return { ...next, ...trendQuery(view) }
}
/** A history drill-down carries a bounded source range; tenant ids are never forwarded. */
export function trendReturnContext(query: Record<string, unknown>): Record<string, string> {
  const itemId = materialRecordId(query.trendItem)
  if (!itemId || typeof query.trendStartAt !== 'string' || typeof query.trendEndAt !== 'string') return {}
  if (!/(Z|[+-]\d{2}:\d{2})$/i.test(query.trendStartAt) || !/(Z|[+-]\d{2}:\d{2})$/i.test(query.trendEndAt))
    return {}
  const state = parseActivityState({ startAt: query.trendStartAt, endAt: query.trendEndAt })
  if (
    state.startAt !== new Date(query.trendStartAt).toJSON() ||
    state.endAt !== new Date(query.trendEndAt).toJSON()
  )
    return {}
  return {
    trendItem: itemId,
    trendStartAt: state.startAt,
    trendEndAt: state.endAt,
    ...trendQuery(parseTrendView(query)),
  }
}
export function returnTrendTarget(query: Record<string, unknown>) {
  const source = trendReturnContext(query)
  return trendTarget(
    query,
    {
      ...parseActivityState({ startAt: source.trendStartAt, endAt: source.trendEndAt }),
      itemId: source.trendItem ?? '',
    },
    source.trendItem ?? '',
  )
}
export function trendHistoryTarget(
  query: Record<string, unknown>,
  state: ActivityState,
  view: TrendView,
  day: InventoryTrendDay,
) {
  return {
    view: 'history',
    ...inventoryNavigationContext(query),
    ...activityQuery({ ...state, startAt: day.startAt, endAt: day.endAt, keyword: '', kind: '', page: 1 }),
    trendItem: state.itemId,
    trendStartAt: state.startAt,
    trendEndAt: state.endAt,
    ...trendQuery({ ...view, day: day.date }),
  }
}
