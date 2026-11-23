import { describe, expect, it } from 'vitest'
import { buildCsv, csvCell } from './report'
import { en, zh } from './messages'

describe('inventory reports', () => {
  it('escapes delimiters, quotes and line breaks and uses a UTF-8 BOM', () => {
    expect(buildCsv([['原料', 'name'], ['a,"b"\nc', 0.125]])).toBe('\uFEFF"原料","name"\r\n"a,""b""\nc","0.125"')
  })
  it('protects material names and reasons from spreadsheet formula execution', () => {
    for (const value of ['=HYPERLINK("https://example.com")', '+cmd', '-cmd', '@SUM(A1)', ' \t=1+1', '\r@SUM(A1)']) {
      expect(csvCell(value)).toMatch(/^"'/)
    }
    expect(csvCell(-0.125)).toBe('"-0.125"')
  })
  it('provides the same translation keys in both supported languages', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(zh).sort())
    expect(Object.values(en).every((value) => value.trim())).toBe(true)
  })
})
