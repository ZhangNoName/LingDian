export type NavItem = {
  label: string
  to: string
  caption: string
}

export const navigationItems: NavItem[] = [
  { label: '工作台', to: '/', caption: '今日经营与待办' },
  { label: '门店管理', to: '/stores', caption: '营业设置与桌台码' },
  { label: '商品与菜单', to: '/products', caption: '商品、分类、套餐、库存' },
  { label: '订单中心', to: '/orders', caption: '订单履约与售后' },
  { label: '用户与会员', to: '/members', caption: '用户资产与会员体系' },
  { label: '营销中心', to: '/marketing', caption: '活动、优惠券与推荐位' },
  { label: '统计分析', to: '/analytics', caption: '销售、商品、用户分析' },
  { label: '仓库管理', to: '/warehouse', caption: '库存、采购、调拨、盘点' },
  { label: '财务结算', to: '/finance', caption: '支付流水、退款、对账' },
  { label: '系统设置', to: '/settings', caption: '账号权限、设备与主题' },
]
