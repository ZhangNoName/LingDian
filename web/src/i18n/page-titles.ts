import type { Locale } from './locale'
const titles: Record<string, [string, string]> = {
  dashboard: ['工作台', 'Business overview'],
  stores: ['门店设置', 'Store settings'],
  products: ['商品与菜单', 'Products & menu'],
  orders: ['订单管理', 'Orders'],
  warehouse: ['库存管理', 'Inventory'],
  settings: ['系统设置', 'Settings'],
  login: ['商家登录', 'Merchant sign-in'],
  'forgot-password': ['重设密码', 'Reset password'],
  'change-password': ['修改密码', 'Change password'],
  'profile-nickname': ['个人资料', 'Profile'],
  members: ['用户与会员', 'Members'],
  marketing: ['营销中心', 'Marketing'],
  analytics: ['统计分析', 'Analytics'],
  finance: ['财务结算', 'Finance'],
}
export function pageTitle(name: unknown, locale: Locale): string {
  const value = titles[String(name)]
  return value?.[locale === 'en-US' ? 1 : 0] ?? (locale === 'en-US' ? 'LingDian Console' : '零点管理后台')
}
