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
    to: '/',
    icon: LayoutDashboard,
  },
  {
    label: '门店设置',
    to: '/stores',
    icon: Store,
  },
  {
    label: '商品与菜单',
    to: '/products',
    icon: Boxes,
  },
  {
    label: '订单管理',
    to: '/orders',
    icon: ShoppingCart,
  },
  {
    label: '库存管理',
    to: '/warehouse',
    icon: Package,
  },
  {
    label: '系统设置',
    to: '/settings',
    icon: Settings,
  },
]

const plannedNavigationItems: NavigationItem[] = [
  { label: '用户与会员', to: '/members', icon: ShieldCheck },
  { label: '营销中心', to: '/marketing', icon: Megaphone },
  { label: '统计分析', to: '/analytics', icon: BarChart3 },
  { label: '财务结算', to: '/finance', icon: Wallet },
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
