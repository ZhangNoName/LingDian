import type { Component } from 'vue'
import {
  BarChart3,
  Boxes,
  LayoutDashboard,
  Megaphone,
  Package,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Store,
  Wallet,
} from '@lingdian/icons/web'
import { plannedModulesEnabled } from './features'

export type NavigationItem = {
  label: string
  caption: string
  to: string
  icon: Component
}

export type DashboardAction = {
  label: string
  to: string
}

const implementedNavigationItems: NavigationItem[] = [
  {
    label: '工作台',
    caption: '已接入能力与常用操作入口',
    to: '/',
    icon: LayoutDashboard,
  },
  {
    label: '门店设置',
    caption: '当前门店信息与营业状态',
    to: '/stores',
    icon: Store,
  },
  {
    label: '商品与菜单',
    caption: '商品、分类、套餐与规格配置',
    to: '/products',
    icon: Boxes,
  },
  {
    label: '订单管理',
    caption: '订单查询、状态流转、退款与详情追踪',
    to: '/orders',
    icon: ShoppingCart,
  },
  {
    label: '系统设置',
    caption: '账号角色、权限与设备设置',
    to: '/settings',
    icon: Settings,
  },
]

const plannedNavigationItems: NavigationItem[] = [
  { label: '用户与会员', caption: '会员等级、积分与优惠资产', to: '/members', icon: ShieldCheck },
  { label: '营销中心', caption: '活动、Banner 与推荐位配置', to: '/marketing', icon: Megaphone },
  { label: '统计分析', caption: '经营分析、商品排行与活动效果', to: '/analytics', icon: BarChart3 },
  { label: '仓库管理', caption: '库存、采购与出入库管理', to: '/warehouse', icon: Package },
  { label: '财务结算', caption: '支付流水、退款与对账结算', to: '/finance', icon: Wallet },
]

export function createNavigationItems(includePlanned = false): NavigationItem[] {
  return includePlanned
    ? [...implementedNavigationItems, ...plannedNavigationItems]
    : [...implementedNavigationItems]
}

export const navigationItems = createNavigationItems(plannedModulesEnabled)

export const dashboardActions: DashboardAction[] = [
  { label: '管理商品', to: '/products' },
  { label: '查看订单', to: '/orders' },
  { label: '查看门店', to: '/stores' },
  { label: '配置外部集成', to: '/settings' },
]
