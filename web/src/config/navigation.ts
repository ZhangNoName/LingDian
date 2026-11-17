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
    caption: '经营概览与待处理事项',
    to: '/',
    icon: LayoutDashboard,
  },
  {
    label: '门店设置',
    caption: '当前门店资料与营业状态',
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
    caption: '订单查询、履约状态与历史记录',
    to: '/orders',
    icon: ShoppingCart,
  },
  {
    label: '库存管理',
    caption: '原料、补货预警与变动记录',
    to: '/warehouse',
    icon: Package,
  },
  {
    label: '系统设置',
    caption: '账号资料、安全与外部集成',
    to: '/settings',
    icon: Settings,
  },
]

const plannedNavigationItems: NavigationItem[] = [
  { label: '用户与会员', caption: '会员等级、积分与优惠资产', to: '/members', icon: ShieldCheck },
  { label: '营销中心', caption: '活动、Banner 与推荐位配置', to: '/marketing', icon: Megaphone },
  { label: '统计分析', caption: '经营分析、商品排行与活动效果', to: '/analytics', icon: BarChart3 },
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
  { label: '管理库存', to: '/warehouse' },
  { label: '查看门店', to: '/stores' },
  { label: '配置外部集成', to: '/settings' },
]
