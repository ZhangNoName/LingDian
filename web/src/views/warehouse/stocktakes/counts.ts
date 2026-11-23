import type { StocktakeLine } from '@lingdian/contracts'
export type CountInput = string | number
export function countValue(value: CountInput): number | null {
  return typeof value === 'string' && value.trim() === '' ? null : Number(value)
}
export function validCount(value: CountInput): boolean {
  const number = countValue(value)
  return (
    number === null ||
    (Number.isFinite(number) &&
      number >= 0 &&
      number <= 999999 &&
      Math.abs(Math.round(number * 1000) - number * 1000) < 0.000001)
  )
}
export function countDraft(lines: StocktakeLine[]) {
  return Object.fromEntries(
    lines.map((line) => [line.id, line.countedQuantity === null ? '' : String(line.countedQuantity)]),
  )
}
export function countsChanged(lines: StocktakeLine[], draft: Record<string, CountInput>) {
  return lines.some((line) => countValue(draft[line.id] ?? '') !== line.countedQuantity)
}
