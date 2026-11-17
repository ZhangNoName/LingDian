import { expect, it } from 'vitest'
import type { InventoryReportRow } from '@lingdian/contracts'
import { analyzeRows, analysisBars, filterAnalysis } from './model'
const row = (patch: Partial<InventoryReportRow> = {}): InventoryReportRow => ({
  itemId: 'flour',
  code: 'F',
  name: 'Flour',
  unit: 'kg',
  opening: 10,
  received: 2,
  issued: 1.125,
  lost: 0.375,
  countGain: 0.5,
  countLoss: 1.25,
  closing: 9.75,
  movementCount: 6,
  ...patch,
})
it('keeps per-material units, physical outflow and count differences separate with zero-denominator loss rates', () => {
  const result = analyzeRows([
    row(),
    row({ itemId: 'milk', unit: 'l', issued: 0, lost: 0, countGain: 1, countLoss: 1 }),
  ])
  expect(result[0]).toMatchObject({ outflow: 1.5, lossRate: 0.25, countDifference: -0.75, unit: 'kg' })
  expect(result[1]).toMatchObject({ outflow: 0, lossRate: null, countDifference: 0, unit: 'l' })
  expect(filterAnalysis(result, 'COUNT', 'CODE')).toHaveLength(2)
  expect(filterAnalysis(result, 'LOSS', 'CODE').map((row) => row.itemId)).toEqual(['flour'])
  expect(result[1]!.countGain).toBe(1)
})
it('sorts by exact loss ratios without comparing quantities in different units and keeps source rows intact', () => {
  const input = [
    row({ itemId: 'tiny', code: 'A', unit: 'bag', issued: 1000, lost: 0.001 }),
    row({ itemId: 'large', code: 'B', unit: 'l', issued: 3, lost: 1 }),
    row({ itemId: 'none', code: 'C', issued: 0, lost: 0 }),
  ]
  const derived = analyzeRows(input)
  expect(filterAnalysis(derived, 'ALL', 'LOSS_RATE').map((row) => row.itemId)).toEqual(['large', 'tiny', 'none'])
  expect(derived[0]!.lossRate).toBeGreaterThan(0)
  expect(input[0]).not.toHaveProperty('outflow')
  const bars = analysisBars(input[1]!)
  expect(bars.every((bar) => bar.width >= 0 && bar.width <= 100)).toBe(true)
  expect(bars.find((bar) => bar.key === 'issued')!.width).toBe(100)
  expect(
    analysisBars(row({ received: 0, issued: 0, lost: 0, countGain: 0, countLoss: 0 })).every((bar) => bar.width === 0),
  ).toBe(true)
})
it('refuses unsafe or invalid derived totals rather than silently returning rounded analysis', () => {
  for (const patch of [
    { issued: NaN },
    { lost: -1 },
    { received: Infinity },
    { issued: Number.MAX_SAFE_INTEGER / 1000, lost: Number.MAX_SAFE_INTEGER / 1000 },
  ])
    expect(() => analyzeRows([row(patch)])).toThrow('inventory.analysisTooLarge')
  expect(analyzeRows([row({ issued: 0.001, lost: 0.002, countGain: 0.001, countLoss: 0.002 })])[0]).toMatchObject({
    outflow: 0.003,
    countDifference: -0.001,
  })
})
