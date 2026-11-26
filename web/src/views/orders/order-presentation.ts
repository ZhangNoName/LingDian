import { isDirectCustomerOrder } from '@lingdian/contracts'
import type {
  OrderDetail,
  OrderListItem,
  OrderSource,
  OrderStatus,
  OrderStatusAction,
  OrderType,
  PaymentChannel,
} from './types'
import type { BadgeVariants } from '@lingdian/console-ui/badge'

export type OrderTagType = 'primary' | 'success' | 'warning' | 'danger' | 'info'

export function orderCustomerName(order: Pick<OrderListItem, 'customer_name' | 'customer_nickname'>, locale = 'zh-CN'): string {
  const nickname = order.customer_nickname?.trim()
  if (nickname) return nickname
  const name = order.customer_name.trim()
  if (name && name !== 'Customer') return name
  return locale === 'en-US' ? 'Customer' : '顾客'
}

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
  APP: '零点 App',
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

const statusTagTypes: Record<OrderStatus, NonNullable<BadgeVariants['variant']>> = {
  CREATING: 'info',
  PENDING_PAYMENT: 'warning',
  PAID: 'info',
  PREPARING: 'warning',
  READY: 'attention',
  COMPLETED: 'success',
  TIMED_OUT: 'secondary',
  REFUNDING: 'warning',
  REFUNDED: 'secondary',
  CANCELLED: 'secondary',
  FAILED: 'destructive',
  DELETED: 'secondary',
}

const manualActionLabels: Partial<Record<OrderStatus, readonly [zh: string, en: string]>> = {
  PENDING_PAYMENT: ['转待支付', 'Await payment'],
  PAID: ['标记已支付', 'Confirm cash payment'],
  PREPARING: ['进入制作', 'Start preparation'],
  READY: ['待取餐', 'Ready for pickup'],
  COMPLETED: ['已完成', 'Complete order'],
  TIMED_OUT: ['标记超时', 'Mark timed out'],
  REFUNDING: ['发起退款', 'Start cash refund'],
  REFUNDED: ['直接退款', 'Record cash refund'],
  CANCELLED: ['取消订单', 'Cancel order'],
  FAILED: ['标记失败', 'Mark failed'],
}

const deletableStatuses = new Set<OrderStatus>([
  'CANCELLED',
  'TIMED_OUT',
  'FAILED',
  'REFUNDED',
  'COMPLETED',
])

const englishLabels: Record<string, string> = {
  CREATING: 'Creating', PENDING_PAYMENT: 'Awaiting payment', PAID: 'Paid', PREPARING: 'Preparing', READY: 'Ready for pickup', COMPLETED: 'Completed', TIMED_OUT: 'Timed out', REFUNDING: 'Refunding', REFUNDED: 'Refunded', CANCELLED: 'Cancelled', FAILED: 'Failed', DELETED: 'Deleted',
  DINE_IN: 'Dine-in', TAKEOUT: 'Delivery', PICKUP: 'Pickup', CASH: 'Cash', WECHAT: 'WeChat Pay', ALIPAY: 'Alipay', UNIONPAY: 'UnionPay', STRIPE: 'Stripe', PAYPAL: 'PayPal', CUSTOMER_SCAN: 'Customer scan', OTHER: 'Other', MINIAPP: 'Mini app', MEITUAN_WAIMAI: 'Meituan delivery', JD_DAOJIA: 'JD Daojia', POS: 'Point of sale', MANUAL: 'Manual entry',
}

export function orderSourceLabel(source: OrderSource | string | null | undefined, locale = 'zh-CN') {
  if (!source) return locale === 'en-US' ? 'Historical order' : '历史订单'
  if (locale === 'en-US') return source === 'APP' ? 'LingDian app' : (englishLabels[source] ?? source)
  return orderSourceLabels[source as OrderSource] ?? source
}

export function pickupCodeLabel(code: string | null | undefined) {
  return code?.trim() || '—'
}

export function pickupBusinessDateLabel(date: string | null | undefined) {
  return date?.trim() || '未记录'
}

export function statusLabel(status: OrderStatus | string, locale = 'zh-CN'): string {
  if (locale === 'en-US') return englishLabels[status] ?? `Unknown status (${status})`
  return statusLabels[status as OrderStatus] ?? `未知状态（${status}）`
}

export function orderTypeLabel(type: OrderType | string, locale = 'zh-CN'): string {
  if (locale === 'en-US') return englishLabels[type] ?? type
  return orderTypeLabels[type as OrderType] ?? type
}

export function paymentChannelLabel(channel: PaymentChannel | string | undefined, locale = 'zh-CN'): string {
  if (!channel) return locale === 'en-US' ? 'Not recorded' : '未记录'
  if (locale === 'en-US') return englishLabels[channel] ?? channel
  return paymentChannelLabels[channel as PaymentChannel] ?? channel
}

export function statusTagType(status: OrderStatus): NonNullable<BadgeVariants['variant']> {
  return statusTagTypes[status]
}

export function orderStatusLogNote({
  from_status, to_status, operator_name, note,
}: Pick<OrderDetail['status_logs'][number], 'from_status' | 'to_status' | 'operator_name' | 'note'>): string | undefined {
  if (!note?.trim()) return
  if (operator_name) return note

  // These automatic notes repeat the transition already shown in the timeline.
  if (from_status === null && to_status === 'CREATING' && note === 'Order created') return
  if (from_status === 'CREATING' && to_status === 'PENDING_PAYMENT' && note === 'Waiting for payment') return
  if (from_status === 'CREATING' && to_status === 'PREPARING' && note === 'Order accepted for preparation') return
  return note
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
  order: Pick<OrderListItem, 'status' | 'allowed_statuses'> | null,
  locale = 'zh-CN',
): OrderStatusAction[] {
  return (order?.allowed_statuses ?? []).flatMap(value => {
    const labels = manualActionLabels[value]
    if (!Array.isArray(labels)) return []
    const label = locale === 'en-US' ? labels[1]
      : value === 'CANCELLED' && order?.status === 'CREATING' ? '标记取消'
        : value === 'REFUNDED' && order?.status === 'REFUNDING' ? '退款完成'
          : labels[0]
    return [{ value, label }]
  })
}

export function canDeleteOrderStatus(status: OrderStatus | undefined): boolean {
  return status ? deletableStatuses.has(status) : false
}

export function canCollectOrderPayment(
  order: Pick<OrderListItem, 'status' | 'payment_required' | 'payable_amount' | 'order_source' | 'payment_channel'>,
): boolean {
  return order.status === 'PENDING_PAYMENT'
    && order.payment_required !== false
    && order.payable_amount > 0
    && !(isDirectCustomerOrder(order.order_source) && order.payment_channel === 'CASH')
}

export function formatDateTime(value: string | undefined, locale = 'zh-CN'): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat(locale, {
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
