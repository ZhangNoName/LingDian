import { describe, expect, it } from 'vitest'
import { activityQuery, dateInput, parseActivityState, periodFromDates } from './activity-state'

describe('inventory activity view state', () => {
  it('turns inclusive local dates into explicit instants with an exclusive end', () => {
    const result = periodFromDates('2026-11-01', '2026-11-07')
    expect(dateInput(new Date(result.startAt))).toBe('2026-11-01')
    expect(dateInput(new Date(Date.parse(result.endAt) - 1))).toBe('2026-11-07')
    expect(new Date(result.startAt).getHours()).toBe(0)
    expect(new Date(result.endAt).getHours()).toBe(0)
  })
  it('rejects invalid calendar dates, reversed periods and overlong reports', () => {
    for (const [from, to] of [['2026-02-30', '2026-03-01'], ['2026-11-07', '2026-11-01'], ['2025-01-01', '2026-11-01'], ['', '2026-11-01']]) expect(() => periodFromDates(from!, to!)).toThrow('inventory.invalidPeriod')
  })
  it('round-trips filters and does not place a tenant or store id into shareable state', () => {
    const value = { ...periodFromDates('2026-11-01', '2026-11-07'), keyword: 'Coffee', itemId: 'item/1', kind: 'LOSS' as const, page: 2 }
    expect(parseActivityState(activityQuery(value))).toEqual(value)
    expect(activityQuery(value)).not.toHaveProperty('storeId')
  })
  it('normalizes malformed links to a valid period and bounded paging', () => {
    const state = parseActivityState({ startAt: ['bad'], endAt: 'invalid', kind: 'DELETE', page: -1, keyword: 'x'.repeat(300) }, new Date('2026-11-17T12:00:00Z'))
    expect(state.kind).toBe(''); expect(state.page).toBe(1); expect(state.keyword).toHaveLength(120)
    expect(Date.parse(state.startAt)).toBeLessThan(Date.parse(state.endAt))
  })
})
