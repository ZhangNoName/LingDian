import { describe, expect, it } from 'vitest'
import {
  canCollectOrderPayment,
  canDeleteOrderStatus,
  orderCustomerName,
  orderSourceLabel,
  orderStatusActions,
  orderStatusLogNote,
  paymentChannelLabel,
  pickupBusinessDateLabel,
  pickupCodeLabel,
  statusLabel,
} from './order-presentation'

describe('order presentation', () => {
  it('omits automatic notes that repeat order creation transitions', () => {
    expect(orderStatusLogNote({ from_status: null, to_status: 'CREATING', operator_name: null, note: 'Order created' })).toBeUndefined()
    expect(orderStatusLogNote({ from_status: 'CREATING', to_status: 'PENDING_PAYMENT', operator_name: null, note: 'Waiting for payment' })).toBeUndefined()
    expect(orderStatusLogNote({ from_status: 'CREATING', to_status: 'PREPARING', operator_name: null, note: 'Order accepted for preparation' })).toBeUndefined()
  })

  it('keeps operator notes and other system notes in the timeline', () => {
    expect(orderStatusLogNote({ from_status: 'CREATING', to_status: 'PENDING_PAYMENT', operator_name: '商家', note: 'Waiting for payment' })).toBe('Waiting for payment')
    const note = '已核对现金\n  已交班'
    expect(orderStatusLogNote({ from_status: 'PENDING_PAYMENT', to_status: 'PAID', operator_name: '商家', note })).toBe(note)
    expect(orderStatusLogNote({ from_status: 'CREATING', to_status: 'PENDING_PAYMENT', operator_name: null, note: 'Waiting for payment at the counter' })).toBe('Waiting for payment at the counter')
    expect(orderStatusLogNote({ from_status: 'PENDING_PAYMENT', to_status: 'TIMED_OUT', operator_name: null, note: 'Waiting for payment' })).toBe('Waiting for payment')
  })

  it('uses a saved nickname and falls back to the order name or a localized customer label', () => {
    expect(orderCustomerName({ customer_name: 'Customer', customer_nickname: '  小栗子  ' })).toBe('小栗子')
    expect(orderCustomerName({ customer_name: '收货人', customer_nickname: ' ' })).toBe('收货人')
    expect(orderCustomerName({ customer_name: 'Customer' })).toBe('顾客')
    expect(orderCustomerName({ customer_name: 'Customer', customer_nickname: null }, 'en-US')).toBe('Customer')
  })

  it.each([
    ['MINIAPP', '小程序'],
    ['APP', '零点 App'],
    ['MEITUAN_WAIMAI', '美团外卖'],
    ['JD_DAOJIA', '京东到家'],
    ['POS', '收银台'],
    ['MANUAL', '人工录单'],
  ] as const)('maps the %s order source', (source, expected) => {
    expect(orderSourceLabel(source)).toBe(expected)
  })

  it('keeps unknown future sources visible', () => {
    expect(orderSourceLabel('PARTNER_API')).toBe('PARTNER_API')
  })

  it('renders historical null fields without leaking null or undefined', () => {
    expect(orderSourceLabel(null)).toBe('历史订单')
    expect(orderSourceLabel(undefined)).toBe('历史订单')
    expect(pickupCodeLabel(null)).toBe('—')
    expect(pickupCodeLabel(undefined)).toBe('—')
    expect(pickupBusinessDateLabel(null)).toBe('未记录')
    expect(pickupBusinessDateLabel(undefined)).toBe('未记录')
  })

  it('preserves leading zeroes in pickup codes', () => {
    expect(pickupCodeLabel(' 007 ')).toBe('007')
  })

  it('uses the shared payment contract, including provider channels', () => {
    expect(paymentChannelLabel('UNIONPAY')).toBe('银联')
    expect(paymentChannelLabel('STRIPE')).toBe('Stripe')
    expect(paymentChannelLabel('PAYPAL')).toBe('PayPal')
  })

  it('renders only status transitions returned by the server, in their original order', () => {
    expect(orderStatusActions({ status: 'PAID', allowed_statuses: ['READY', 'COMPLETED'] })).toEqual([
      { value: 'READY', label: '待取餐' },
      { value: 'COMPLETED', label: '已完成' },
    ])
    expect(orderStatusActions({ status: 'PENDING_PAYMENT', allowed_statuses: [] })).toEqual([])
    expect(orderStatusActions({ status: 'PENDING_PAYMENT' })).toEqual([])
    expect(canDeleteOrderStatus('COMPLETED')).toBe(true)
    expect(canDeleteOrderStatus('PAID')).toBe(false)
  })

  it('offers QR collection only for pending orders eligible to receive payment', () => {
    const order = { status: 'PENDING_PAYMENT', payment_required: true, payable_amount: 18, order_source: 'POS', payment_channel: 'CASH' } as const
    expect(canCollectOrderPayment(order)).toBe(true)
    expect(canCollectOrderPayment({ ...order, order_source: 'MINIAPP', payment_channel: 'WECHAT' })).toBe(true)
    expect(canCollectOrderPayment({ ...order, order_source: 'MINIAPP' })).toBe(false)
    expect(canCollectOrderPayment({ ...order, order_source: 'APP' })).toBe(false)
    expect(canCollectOrderPayment({ ...order, payment_required: false })).toBe(false)
    expect(canCollectOrderPayment({ ...order, payable_amount: 0 })).toBe(false)
    expect(canCollectOrderPayment({ ...order, status: 'PAID' })).toBe(false)
  })

  it('distinguishes a direct cash refund from completing a refund in progress', () => {
    expect(orderStatusActions({ status: 'PAID', allowed_statuses: ['REFUNDED'] })[0]?.label).toBe('直接退款')
    expect(orderStatusActions({ status: 'REFUNDING', allowed_statuses: ['REFUNDED'] })[0]?.label).toBe('退款完成')
  })

  it('does not present an unknown future status as a known workflow state', () => {
    expect(statusLabel('WAITING_FOR_DRIVER')).toBe('未知状态（WAITING_FOR_DRIVER）')
  })
})

describe('localized order workflow', () => {
  it('translates labels from the workflow', () => {
    expect(statusLabel('PAID', 'en-US')).toBe('Paid')
    expect(orderSourceLabel('MINIAPP', 'en-US')).toBe('Mini app')
    expect(orderSourceLabel('APP', 'en-US')).toBe('LingDian app')
    expect(paymentChannelLabel('WECHAT', 'en-US')).toBe('WeChat Pay')
    expect(orderStatusActions({ status: 'PENDING_PAYMENT', allowed_statuses: ['PAID'] }, 'en-US')[0]?.label).toBe('Confirm cash payment')
  })
  it('fails closed on a future status instead of crashing the order detail', () => {
    expect(orderStatusActions({ status: 'PAID', allowed_statuses: ['WAITING_FOR_DRIVER' as never] }, 'en-US')).toEqual([])
    expect(statusLabel('WAITING_FOR_DRIVER', 'en-US')).toBe('Unknown status (WAITING_FOR_DRIVER)')
  })
})
