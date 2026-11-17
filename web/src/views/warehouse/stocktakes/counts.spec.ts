import { expect, it } from 'vitest'
import { countDraft, countValue, countsChanged, validCount } from './counts'
import type { StocktakeLine } from '@lingdian/contracts'
it('distinguishes not counted, zero and decimal counts while preserving dirty comparison', () => {
  const lines = [
    { id: 'a', countedQuantity: null },
    { id: 'b', countedQuantity: 0 },
    { id: 'c', countedQuantity: 1.125 },
  ] as StocktakeLine[]
  const draft = countDraft(lines)
  expect(draft).toEqual({ a: '', b: '0', c: '1.125' })
  expect(countValue('')).toBeNull()
  expect(countValue('0')).toBe(0)
  expect(countValue(0)).toBe(0)
  expect(validCount(1.125)).toBe(true)
  expect(countsChanged(lines, draft)).toBe(false)
  expect(countsChanged(lines, { ...draft, a: '0' })).toBe(true)
  expect(countsChanged(lines, { ...draft, c: '1.1250' })).toBe(false)
  for (const value of ['', '0', '1.125', '999999']) expect(validCount(value)).toBe(true)
  for (const value of ['-1', 'NaN', '1.0001', '1000000']) expect(validCount(value)).toBe(false)
})
