import type { Coupon, DiningTable, MemberProfile, OrderMode, PaymentOption, Product } from './types'

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

export const categories = ['全部', '主食', '套餐', '小吃', '饮品']

export const products: Product[] = [
  {
    id: 'p1',
    name: '炙烤鸡腿饭',
    description: '招牌主食，含时蔬和溏心蛋。',
    category: '主食',
    price: 29.9,
    stock: 128,
    tag: '热销',
    badgeVariant: 'secondary',
  },
  {
    id: 'p2',
    name: '黑椒牛肉意面',
    description: '经典西式主食，适合晚市组合。',
    category: '主食',
    price: 32,
    stock: 64,
    tag: '新品',
    badgeVariant: 'outline',
  },
  {
    id: 'p3',
    name: '双人分享套餐',
    description: '鸡腿饭 + 小吃 + 饮品组合。',
    category: '套餐',
    price: 58.8,
    stock: 36,
    tag: '套餐',
    badgeVariant: 'secondary',
  },
  {
    id: 'p4',
    name: '现炸薯条',
    description: '适合加购，支持单点。',
    category: '小吃',
    price: 12,
    stock: 86,
    tag: '加购',
    badgeVariant: 'outline',
  },
  {
    id: 'p5',
    name: '冰美式',
    description: '门店现制饮品。',
    category: '饮品',
    price: 16,
    stock: 72,
    tag: '饮品',
    badgeVariant: 'outline',
  },
  {
    id: 'p6',
    name: '芝士鸡块',
    description: '小食推荐，适合搭配套餐。',
    category: '小吃',
    price: 18,
    stock: 55,
    tag: '推荐',
    badgeVariant: 'secondary',
  },
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
