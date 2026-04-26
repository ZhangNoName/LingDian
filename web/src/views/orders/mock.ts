import type { Coupon, DiningTable, MemberProfile, OrderMode, PaymentOption } from './types'

export const orderModes: OrderMode[] = [
  { label: '堂食', value: 'dine_in' },
  { label: '外带', value: 'takeout' },
  { label: '自提', value: 'pickup' },
]

export const paymentMethods: PaymentOption[] = [
  { label: '现金', value: 'cash' },
  { label: '支付宝', value: 'alipay' },
  { label: '微信', value: 'wechat' },
]

export const diningTables: DiningTable[] = [
  { id: 't-a01', label: 'A01', area: '大厅靠窗区', seats: 2, occupied: false },
  { id: 't-a02', label: 'A02', area: '大厅靠窗区', seats: 4, occupied: true },
  { id: 't-b03', label: 'B03', area: '中厅家庭区', seats: 4, occupied: false },
  { id: 't-b05', label: 'B05', area: '中厅家庭区', seats: 6, occupied: false },
  { id: 't-c01', label: 'C01', area: '吧台区', seats: 2, occupied: true },
  { id: 't-v08', label: 'V08', area: '包厢区', seats: 8, occupied: false },
]

export const memberProfiles: Record<string, MemberProfile> = {
  '13800138000': { name: '张女士', level: '银卡会员', discountRate: 0.95 },
  '13900139000': { name: '李先生', level: '金卡会员', discountRate: 0.9 },
  '13600136000': { name: '王女士', level: '黑金会员', discountRate: 0.85 },
}

export const coupons: Coupon[] = [
  { code: 'none', label: '不使用优惠券', discountAmount: 0 },
  { code: 'NEW8', label: '新人券 - ¥8', discountAmount: 8 },
  { code: 'MEAL12', label: '套餐券 - ¥12', discountAmount: 12 },
  { code: 'VIP15', label: '会员券 - ¥15', discountAmount: 15 },
]
