import { describe, expect, it } from 'vitest'
import {
  canDeleteOrderStatus,
  orderSourceLabel,
  orderStatusActions,
  paymentChannelLabel,
  pickupBusinessDateLabel,
  pickupCodeLabel,
  statusLabel,
} from './order-presentation'

describe('order presentation', () => {
  it.each([
    ['MINIAPP', '小程序'],
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

  it('keeps status transitions and deletion capabilities in one presentation module', () => {
    expect(orderStatusActions('PENDING_PAYMENT', 'CASH').map((action) => action.value))
      .toEqual(['PAID', 'TIMED_OUT', 'CANCELLED', 'FAILED'])
    expect(canDeleteOrderStatus('COMPLETED')).toBe(true)
    expect(canDeleteOrderStatus('PAID')).toBe(false)
  })

  it('only lets cash orders be marked paid manually', () => {
    expect(orderStatusActions('PENDING_PAYMENT', 'CASH').map((action) => action.value))
      .toContain('PAID')
    expect(orderStatusActions('PENDING_PAYMENT', 'WECHAT').map((action) => action.value))
      .toEqual(['TIMED_OUT', 'CANCELLED', 'FAILED'])
    expect(orderStatusActions('PENDING_PAYMENT', undefined).map((action) => action.value))
      .not.toContain('PAID')
  })

  it.each(['PAID', 'PREPARING', 'READY', 'COMPLETED', 'REFUNDING'] as const)(
    'does not expose manual online refund transitions from %s',
    (status) => {
      const actions = orderStatusActions(status, 'ALIPAY').map((action) => action.value)
      expect(actions).not.toContain('REFUNDING')
      expect(actions).not.toContain('REFUNDED')
    },
  )

  it('retains cash refund operations handled by the merchant workflow', () => {
    expect(orderStatusActions('PAID', 'CASH').map((action) => action.value))
      .toEqual(['PREPARING', 'READY', 'COMPLETED', 'REFUNDING', 'REFUNDED'])
    expect(orderStatusActions('REFUNDING', 'CASH').map((action) => action.value))
      .toEqual(['REFUNDED', 'FAILED'])
  })

  it('does not present an unknown future status as a known workflow state', () => {
    expect(statusLabel('WAITING_FOR_DRIVER')).toBe('未知状态（WAITING_FOR_DRIVER）')
  })
})
