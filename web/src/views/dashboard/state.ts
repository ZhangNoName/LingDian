import { dateInput, periodFromDates } from '@/views/warehouse/activity-state'
export { dateInput, periodFromDates }
export function dashboardPeriodPreset(days: number, now = new Date()) {
  const start = new Date(now); start.setDate(start.getDate() - days + 1)
  return periodFromDates(dateInput(start), dateInput(now))
}
export function parseDashboardPeriod(query: Record<string, unknown>, now = new Date()) {
  const start = typeof query.startAt === 'string' ? query.startAt : '', end = typeof query.endAt === 'string' ? query.endAt : ''
  if (/(?:Z|[+-]\d{2}:\d{2})$/.test(start) && /(?:Z|[+-]\d{2}:\d{2})$/.test(end) && Number.isFinite(Date.parse(start)) && Number.isFinite(Date.parse(end)) && Date.parse(start) < Date.parse(end) && Date.parse(end) - Date.parse(start) <= 366 * 86400000) return { startAt: new Date(start).toISOString(), endAt: new Date(end).toISOString() }
  return dashboardPeriodPreset(7, now)
}
