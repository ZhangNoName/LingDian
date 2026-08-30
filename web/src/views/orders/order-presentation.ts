import type { OrderSource } from './types'

const orderSourceLabels: Record<OrderSource, string> = {
  MINIAPP: '小程序',
  MEITUAN_WAIMAI: '美团外卖',
  JD_DAOJIA: '京东到家',
  POS: '收银台',
  MANUAL: '人工录单',
}

export function orderSourceLabel(source: OrderSource | string | null | undefined) {
  if (!source) return '历史订单'
  return orderSourceLabels[source as OrderSource] ?? source
}

export function pickupCodeLabel(code: string | null | undefined) {
  return code?.trim() || '—'
}

export function pickupBusinessDateLabel(date: string | null | undefined) {
  return date?.trim() || '未记录'
}
