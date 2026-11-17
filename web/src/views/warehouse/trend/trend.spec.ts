import { describe, expect, it } from 'vitest'
import type { InventoryDailyTrend, InventoryTrendDay } from '@lingdian/contracts'
import { parseActivityState } from '../activity-state'
import { buildCsv } from '../report'
import {
  parseTrendView,
  returnTrendTarget,
  trendHistoryTarget,
  trendReturnContext,
  trendTarget,
  zonedDate,
} from './state'
import { selectedDay, trendGeometry, validateTrend } from './model'
import { trendCsvRows } from './export'
function day(index: number, changes: Partial<InventoryTrendDay> = {}): InventoryTrendDay {
  const startAt = new Date(Date.UTC(2026, 2, 1 + index)).toISOString(),
    endAt = new Date(Date.UTC(2026, 2, 2 + index)).toISOString()
  return {
    date: startAt.slice(0, 10),
    startAt,
    endAt,
    state: 'RECORDED',
    partial: false,
    opening: 12,
    received: 0,
    issued: 0,
    lost: 0,
    countGain: 0,
    countLoss: 0,
    closing: 12,
    reservedOpening: 3,
    reservedClosing: 3,
    availableClosing: 9,
    movementCount: 0,
    ...changes,
  }
}
function snapshot(): InventoryDailyTrend {
  const days = Array.from({ length: 31 }, (_, index) => day(index))
  return {
    storeId: 'store/a',
    item: {
      id: 'item/1',
      storeId: 'store/a',
      name: '=Flour',
      code: 'FLOUR',
      unit: 'kg',
    } as InventoryDailyTrend['item'],
    startAt: days[0]!.startAt,
    endAt: days[30]!.endAt,
    timeZone: 'UTC',
    asOfAt: days[30]!.endAt,
    generatedAt: days[30]!.endAt,
    summary: { ...days[0]! },
    days,
  }
}
describe('daily trend navigation and snapshot', () => {
  it('preserves exact millisecond source range and material context through daily history, without tenant ids', () => {
    const state = parseActivityState({
      startAt: '2026-03-01T01:02:03.456Z',
      endAt: '2026-03-31T12:34:56.789Z',
      itemId: 'item/1',
      keyword: 'irrelevant',
      page: '8',
    })
    const view = { timeZone: 'America/New_York', day: '2026-03-08', page: 2 },
      context = {
        storeId: 'foreign',
        tenantId: 'foreign',
        materialId: 'item/1',
        stockPage: '3',
        stockKeyword: 'Flour',
      }
    const target = trendTarget(context, state, state.itemId, view)
    expect(target).toMatchObject({
      startAt: state.startAt,
      endAt: state.endAt,
      reportView: 'trend',
      trendZone: view.timeZone,
      trendDay: view.day,
      trendPage: '2',
      materialId: 'item/1',
      stockPage: '3',
    })
    for (const key of ['storeId', 'tenantId', 'keyword', 'page', 'kind'])
      expect(target).not.toHaveProperty(key)
    const selected = day(7),
      history = trendHistoryTarget(target, state, view, selected)
    expect(history).toMatchObject({
      view: 'history',
      startAt: selected.startAt,
      endAt: selected.endAt,
      itemId: state.itemId,
    })
    expect(returnTrendTarget(history)).toEqual(target)
    for (const malformed of [
      { trendStartAt: '2026-03-01' },
      { trendStartAt: 'broken' },
      { trendItem: ['item'] },
      { trendEndAt: '2028-01-01T00:00:00Z' },
    ])
      expect(trendReturnContext({ ...history, ...malformed })).toEqual({})
  })
  it('normalizes date, zone and bounded page state without coercing arrays', () => {
    expect(
      parseTrendView({ trendZone: 'wrong/zone', trendDay: '2026-02-30', trendPage: '1e2' }, 'UTC'),
    ).toEqual({ timeZone: 'UTC', day: '', page: 1 })
    expect(
      parseTrendView({ trendZone: ['UTC'], trendDay: ['2026-03-01'], trendPage: ['2'] }, 'Asia/Shanghai'),
    ).toEqual({ timeZone: 'Asia/Shanghai', day: '', page: 1 })
    expect(zonedDate('2026-03-08T04:59:59.999Z', 'America/New_York')).toBe('2026-03-07')
    expect(zonedDate('2026-03-08T05:00:00Z', 'America/New_York')).toBe('2026-03-08')
  })
  it('rejects wrong identities, overlapping days, nonfinite summary and inconsistent availability', () => {
    const data = snapshot()
    expect(validateTrend(data, 'store/a', 'item/1')).toBe(data)
    expect(() => validateTrend(data, 'foreign', 'item/1')).toThrow()
    for (const mutate of [
      (d: InventoryDailyTrend) => {
        d.summary.closing = NaN
      },
      (d: InventoryDailyTrend) => {
        d.days[0]!.availableClosing = 12
      },
      (d: InventoryDailyTrend) => {
        d.days[1]!.startAt = d.days[0]!.startAt
      },
      (d: InventoryDailyTrend) => {
        d.days[0]!.movementCount = 0.5
      },
    ]) {
      const bad = structuredClone(data)
      mutate(bad)
      expect(() => validateTrend(bad, 'store/a', 'item/1')).toThrow()
    }
  })
  it('exports every snapshot day with aligned columns, raw quantities, blank states and formula protection', () => {
    const data = snapshot()
    Object.assign(data.days[30]!, {
      state: 'FUTURE',
      opening: null,
      closing: null,
      reservedOpening: null,
      reservedClosing: null,
      availableClosing: null,
    })
    const rows = trendCsvRows(data, '+Store', (key) => key),
      header = rows[8]!,
      body = rows.slice(9)
    expect(body).toHaveLength(31)
    expect(body.every((row) => row.length === header.length)).toBe(true)
    expect(body[0]![header.indexOf('availableClosing')]).toBe(9)
    expect(body[30]![header.indexOf('closing')]).toBe('')
    expect(body[30]![3]).toBe('FUTURE')
    const csv = buildCsv(rows)
    expect(csv).toContain('"\'+Store"')
    expect(csv).toContain('"\'=Flour"')
    expect(csv).toContain(data.days[30]!.date)
  })
  it('keeps quiet days flat, gaps blank, one point centered and zeros finite at phone widths', () => {
    const days = [day(0), day(1), day(2, { state: 'FUTURE', closing: null, availableClosing: null })]
    expect(selectedDay(days, '')).toBe(1)
    expect(selectedDay(days, days[2]!.date)).toBe(2)
    for (const width of [200, 320, 1200]) {
      const graph = trendGeometry(days, width)
      expect(graph.width).toBe(width)
      expect(graph.available).not.toMatch(/NaN|Infinity/)
      expect(graph.available).toContain('L')
      expect(graph.ticks.length).toBeLessThanOrEqual(width < 480 ? 2 : 4)
    }
    const single = trendGeometry([day(0, { closing: 0, availableClosing: 0 })], 320)
    expect(single.x(0)).toBe((single.left + single.right) / 2)
    expect(single.available).not.toMatch(/NaN|Infinity/)
    expect(
      trendGeometry([day(0, { state: 'NOT_CREATED', closing: null, availableClosing: null })], 320).available,
    ).toBe('')
  })
})
