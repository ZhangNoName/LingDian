import type { InventoryDailyTrend } from '@lingdian/contracts'
import { trendNumbers } from './model'
import type { TrendKey } from './locale'
export function trendCsvRows(
  data: InventoryDailyTrend,
  storeName: string,
  t: (key: TrendKey) => string,
): (string | number)[][] {
  return [
    [t('store'), storeName, data.storeId],
    [t('material'), data.item.id, data.item.name, t('code'), data.item.code, t('unit'), data.item.unit],
    [t('period'), data.startAt, data.endAt],
    [t('zone'), data.timeZone],
    [t('asOf'), data.asOfAt],
    [t('generated'), data.generatedAt],
    [t('exportHint')],
    [t('context')],
    [t('date'), t('start'), t('end'), t('state'), t('coverage'), ...trendNumbers.map((key) => t(key))],
    ...data.days.map((day) => [
      day.date,
      day.startAt,
      day.endAt,
      t(day.state),
      t(day.partial ? 'partial' : 'full'),
      ...trendNumbers.map((key) => (day.state === 'RECORDED' ? (day[key] ?? '') : '')),
    ]),
  ]
}
