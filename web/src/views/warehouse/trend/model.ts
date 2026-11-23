import { scaleLinear } from 'd3-scale'
import { line } from 'd3-shape'
import type { InventoryDailyTrend, InventoryTrendDay } from '@lingdian/contracts'
export const trendNumbers = [
  'opening',
  'received',
  'issued',
  'lost',
  'countGain',
  'countLoss',
  'closing',
  'reservedOpening',
  'reservedClosing',
  'availableClosing',
  'movementCount',
] as const
const balances = ['opening', 'closing', 'reservedOpening', 'reservedClosing', 'availableClosing'] as const
function validateValues(row: InventoryDailyTrend['summary'], recorded: boolean) {
  for (const key of trendNumbers) {
    if (!recorded && balances.includes(key as (typeof balances)[number])) {
      if (row[key] !== null) throw Error('invalid blank balance')
    } else if (
      row[key] === null ||
      !Number.isFinite(row[key]) ||
      row[key]! < 0 ||
      !Number.isSafeInteger(Math.round(row[key]! * (key === 'movementCount' ? 1 : 1000)))
    )
      throw Error('invalid quantity')
  }
  if (!Number.isInteger(row.movementCount)) throw Error('invalid movement count')
  if (
    recorded &&
    (row.reservedOpening! > row.opening! ||
      row.reservedClosing! > row.closing! ||
      Math.round(row.availableClosing! * 1000) !==
        Math.round(row.closing! * 1000) - Math.round(row.reservedClosing! * 1000))
  )
    throw Error('inconsistent balance')
}
export function validateTrend(data: InventoryDailyTrend, storeId: string, itemId: string) {
  if (
    !data ||
    data.storeId !== storeId ||
    data.item?.storeId !== storeId ||
    data.item.id !== itemId ||
    !data.item.unit ||
    !data.summary ||
    !Array.isArray(data.days) ||
    !data.days.length ||
    data.days.length > 368
  )
    throw Error('invalid trend snapshot')
  const start = Date.parse(data.startAt),
    end = Date.parse(data.endAt)
  if (
    !(start < end) ||
    !Number.isFinite(Date.parse(data.asOfAt)) ||
    !Number.isFinite(Date.parse(data.generatedAt))
  )
    throw Error('invalid trend range')
  const dates = new Set<string>()
  let previous = start,
    previousDate = ''
  for (const row of data.days) {
    const from = Date.parse(row.startAt),
      until = Date.parse(row.endAt)
    if (
      dates.has(row.date) ||
      row.date <= previousDate ||
      !/^\d{4}-\d{2}-\d{2}$/.test(row.date) ||
      !(from < until) ||
      from < previous ||
      until > end ||
      typeof row.partial !== 'boolean'
    )
      throw Error('invalid day')
    dates.add(row.date)
    previous = until
    previousDate = row.date
    if (!['RECORDED', 'NOT_CREATED', 'FUTURE'].includes(row.state)) throw Error('invalid day state')
    validateValues(row, row.state === 'RECORDED')
  }
  validateValues(
    data.summary,
    data.days.some((day) => day.state === 'RECORDED'),
  )
  return data
}
export function selectedDay(days: InventoryTrendDay[], date: string) {
  const selected = days.findIndex((day) => day.date === date)
  if (selected >= 0) return selected
  for (let index = days.length - 1; index >= 0; index--) if (days[index]!.state === 'RECORDED') return index
  return Math.max(0, days.length - 1)
}
export function trendGeometry(days: InventoryTrendDay[], rawWidth: number) {
  const width = Math.max(200, rawWidth),
    height = width < 480 ? 190 : 220,
    left = width < 480 ? 48 : 58,
    right = width - 18,
    top = 12,
    bottom = height - 30
  const maximum = Math.max(1, ...days.flatMap((day) => [day.closing ?? 0, day.availableClosing ?? 0]))
  const y = scaleLinear().domain([0, maximum]).nice(4).range([bottom, top]),
    scaleX = scaleLinear()
      .domain([0, Math.max(1, days.length - 1)])
      .range([left, right])
  const x = (index: number) => (days.length === 1 ? (left + right) / 2 : scaleX(index))
  const path = (key: 'closing' | 'availableClosing') =>
    line<InventoryTrendDay>()
      .defined((day) => day.state === 'RECORDED')
      .x((_day, index) => x(index))
      .y((day) => y(day[key]!))(days) ?? ''
  const tickCount = Math.min(days.length, width < 480 ? 2 : 4)
  const ticks = Array.from(
    new Set(
      Array.from({ length: tickCount }, (_, index) =>
        Math.round((index * (days.length - 1)) / Math.max(1, tickCount - 1)),
      ),
    ),
  )
  return {
    width,
    height,
    left,
    right,
    top,
    bottom,
    x,
    y,
    ticks,
    yTicks: y.ticks(width < 480 ? 3 : 4),
    onHand: path('closing'),
    available: path('availableClosing'),
  }
}
