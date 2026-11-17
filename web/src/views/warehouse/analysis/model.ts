import type { InventoryReportRow } from '@lingdian/contracts'
export interface AnalysisRow extends InventoryReportRow {
  outflow: number
  lossRate: number | null
  countDifference: number
}
export type AnalysisSubset = 'ALL' | 'LOSS' | 'COUNT'
export type AnalysisOrder = 'CODE' | 'LOSS_RATE'
function scaled(value: number, nonnegative = false): number {
  const result = Math.round(value * 1000)
  if (!Number.isFinite(value) || !Number.isSafeInteger(result) || (nonnegative && value < 0))
    throw new Error('inventory.analysisTooLarge')
  return result
}
export function analyzeRows(rows: InventoryReportRow[]): AnalysisRow[] {
  return rows.map((row) => {
    scaled(row.opening)
    scaled(row.closing)
    scaled(row.received, true)
    const issued = scaled(row.issued, true),
      lost = scaled(row.lost, true),
      outflow = issued + lost
    if (!Number.isSafeInteger(outflow)) throw new Error('inventory.analysisTooLarge')
    const gain = scaled(row.countGain, true),
      loss = scaled(row.countLoss, true)
    return {
      ...row,
      outflow: outflow / 1000,
      countDifference: (gain - loss) / 1000,
      lossRate: outflow === 0 ? null : lost / outflow,
    }
  })
}
export function filterAnalysis(rows: AnalysisRow[], subset: AnalysisSubset, order: AnalysisOrder): AnalysisRow[] {
  return rows
    .filter((row) =>
      subset === 'LOSS' ? row.lost > 0 : subset === 'COUNT' ? row.countGain > 0 || row.countLoss > 0 : true,
    )
    .sort(
      (a, b) =>
        (order === 'LOSS_RATE' ? (b.lossRate ?? -1) - (a.lossRate ?? -1) : 0) ||
        a.code.localeCompare(b.code) ||
        a.itemId.localeCompare(b.itemId),
    )
}
export function analysisBars(row: InventoryReportRow) {
  const values = (['received', 'issued', 'lost', 'countGain', 'countLoss'] as const).map((key) => ({
    key,
    value: row[key],
  }))
  const max = Math.max(0, ...values.map((row) => row.value))
  return values.map((row) => ({ ...row, width: max > 0 ? (row.value / max) * 100 : 0 }))
}
