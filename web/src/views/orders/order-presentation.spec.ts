import { describe, expect, it } from 'vitest'
import {
  orderSourceLabel,
  pickupBusinessDateLabel,
  pickupCodeLabel,
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
})
