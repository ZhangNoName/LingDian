import { describe, it, expect } from 'vitest'
import { dashboardPeriodPreset, parseDashboardPeriod, periodFromDates } from './state'
describe('dashboard date state', () => {
  const now = new Date('2026-11-17T12:00:00Z')
  it('normalizes explicit offsets and preserves a shareable half-open range', () => {
    expect(parseDashboardPeriod({ startAt: '2026-11-01T00:00:00+08:00', endAt: '2026-11-02T00:00:00+08:00' }, now)).toEqual({ startAt: '2026-10-31T16:00:00.000Z', endAt: '2026-11-01T16:00:00.000Z' })
  })
  it('repairs invalid or reversed URLs using a seven-local-day default', () => {
    for (const query of [{}, { startAt: 'invalid' }, { startAt: '2026-11-02T00:00:00Z', endAt: '2026-11-01T00:00:00Z' }]) expect(parseDashboardPeriod(query, now)).toEqual(dashboardPeriodPreset(7, now))
    expect(() => periodFromDates('2026-02-30', '2026-03-01')).toThrow()
  })
})
