import type {
  OrderSource,
  OrderStatus,
  OrderStatusAction,
  OrderType,
  PaymentChannel,
} from './types'

export type OrderTagType = 'primary' | 'success' | 'warning' | 'danger' | 'info'

export const statusOptions: Array<{ label: string; value: OrderStatus }> = [
  { label: '创建中', value: 'CREATING' },
  { label: '待支付', value: 'PENDING_PAYMENT' },
  { label: '已支付', value: 'PAID' },
  { label: '制作中', value: 'PREPARING' },
  { label: '待取餐', value: 'READY' },
  { label: '已完成', value: 'COMPLETED' },
  { label: '已超时', value: 'TIMED_OUT' },
  { label: '退款中', value: 'REFUNDING' },
  { label: '已退款', value: 'REFUNDED' },
  { label: '已取消', value: 'CANCELLED' },
  { label: '失败', value: 'FAILED' },
  { label: '已删除', value: 'DELETED' },
]

export const orderTypeOptions: Array<{ label: string; value: OrderType }> = [
  { label: '堂食', value: 'DINE_IN' },
  { label: '外卖', value: 'TAKEOUT' },
  { label: '自取', value: 'PICKUP' },
]

export const paymentChannelOptions: Array<{ label: string; value: PaymentChannel }> = [
  { label: '现金', value: 'CASH' },
  { label: '微信', value: 'WECHAT' },
  { label: '支付宝', value: 'ALIPAY' },
  { label: '银联', value: 'UNIONPAY' },
  { label: 'Stripe', value: 'STRIPE' },
  { label: 'PayPal', value: 'PAYPAL' },
  { label: '对方扫码', value: 'CUSTOMER_SCAN' },
  { label: '其他', value: 'OTHER' },
]

const orderSourceLabels: Record<OrderSource, string> = {
  MINIAPP: '小程序',
  MEITUAN_WAIMAI: '美团外卖',
  JD_DAOJIA: '京东到家',
  POS: '收银台',
  MANUAL: '人工录单',
}

const statusLabels: Record<OrderStatus, string> = Object.fromEntries(
  statusOptions.map((option) => [option.value, option.label]),
) as Record<OrderStatus, string>

const orderTypeLabels: Record<OrderType, string> = Object.fromEntries(
  orderTypeOptions.map((option) => [option.value, option.label]),
) as Record<OrderType, string>

const paymentChannelLabels: Record<PaymentChannel, string> = Object.fromEntries(
  paymentChannelOptions.map((option) => [option.value, option.label]),
) as Record<PaymentChannel, string>

const statusTagTypes: Record<OrderStatus, OrderTagType> = {
  CREATING: 'info',
  PENDING_PAYMENT: 'warning',
  PAID: 'success',
  PREPARING: 'warning',
  READY: 'primary',
  COMPLETED: 'success',
  TIMED_OUT: 'info',
  REFUNDING: 'warning',
  REFUNDED: 'danger',
  CANCELLED: 'info',
  FAILED: 'danger',
  DELETED: 'info',
}

const actionsByStatus: Record<OrderStatus, OrderStatusAction[]> = {
  CREATING: [
    { label: '转待支付', value: 'PENDING_PAYMENT', type: 'primary' },
    { label: '标记取消', value: 'CANCELLED', type: 'warning' },
    { label: '标记失败', value: 'FAILED', type: 'danger' },
  ],
  PENDING_PAYMENT: [
    { label: '标记已支付', value: 'PAID', type: 'success' },
    { label: '标记超时', value: 'TIMED_OUT', type: 'warning' },
    { label: '取消订单', value: 'CANCELLED', type: 'info' },
    { label: '标记失败', value: 'FAILED', type: 'danger' },
  ],
  PAID: [
    { label: '进入制作', value: 'PREPARING', type: 'primary' },
    { label: '待取餐', value: 'READY', type: 'primary' },
    { label: '已完成', value: 'COMPLETED', type: 'success' },
    { label: '发起退款', value: 'REFUNDING', type: 'warning' },
    { label: '直接退款', value: 'REFUNDED', type: 'danger' },
  ],
  PREPARING: [
    { label: '待取餐', value: 'READY', type: 'primary' },
    { label: '已完成', value: 'COMPLETED', type: 'success' },
    { label: '发起退款', value: 'REFUNDING', type: 'warning' },
    { label: '直接退款', value: 'REFUNDED', type: 'danger' },
  ],
  READY: [
    { label: '已完成', value: 'COMPLETED', type: 'success' },
    { label: '发起退款', value: 'REFUNDING', type: 'warning' },
    { label: '直接退款', value: 'REFUNDED', type: 'danger' },
  ],
  COMPLETED: [
    { label: '发起退款', value: 'REFUNDING', type: 'warning' },
    { label: '直接退款', value: 'REFUNDED', type: 'danger' },
  ],
  REFUNDING: [
    { label: '退款完成', value: 'REFUNDED', type: 'danger' },
    { label: '标记失败', value: 'FAILED', type: 'warning' },
  ],
  TIMED_OUT: [],
  REFUNDED: [],
  CANCELLED: [],
  FAILED: [],
  DELETED: [],
}

const deletableStatuses = new Set<OrderStatus>([
  'CANCELLED',
  'TIMED_OUT',
  'FAILED',
  'REFUNDED',
  'COMPLETED',
])

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

export function statusLabel(status: OrderStatus | string): string {
  return statusLabels[status as OrderStatus] ?? `未知状态（${status}）`
}

export function orderTypeLabel(type: OrderType | string): string {
  return orderTypeLabels[type as OrderType] ?? type
}

export function paymentChannelLabel(channel: PaymentChannel | string | undefined): string {
  if (!channel) return '未记录'
  return paymentChannelLabels[channel as PaymentChannel] ?? channel
}

export function statusTagType(status: OrderStatus): OrderTagType {
  return statusTagTypes[status]
}

export function timelineType(status: OrderStatus): OrderTagType {
  const types: Partial<Record<OrderStatus, OrderTagType>> = {
    PAID: 'success',
    COMPLETED: 'success',
    REFUNDING: 'warning',
    REFUNDED: 'danger',
    CANCELLED: 'warning',
    FAILED: 'danger',
  }
  return types[status] ?? 'primary'
}

export function orderStatusActions(
  status: OrderStatus | undefined,
  paymentChannel: PaymentChannel | undefined,
): OrderStatusAction[] {
  if (!status) return []

  const actions = actionsByStatus[status]
  if (paymentChannel === 'CASH') return actions

  // Online payment and refund states are advanced only by verified provider
  // callbacks. Missing historical channel data is also treated conservatively.
  return actions.filter(
    (action) => !['PAID', 'REFUNDING', 'REFUNDED'].includes(action.value),
  )
}

export function canDeleteOrderStatus(status: OrderStatus | undefined): boolean {
  return status ? deletableStatuses.has(status) : false
}

export function formatDateTime(value: string | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date)
}

export function formatAmount(value: number | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(2) : '—'
}
