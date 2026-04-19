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
} from 'lucide-vue-next'

export type NavigationItem = {
  label: string
  caption: string
  to: string
  icon: Component
}

export const navigationItems: NavigationItem[] = [
  {
    label: '工作台',
    caption: '今日经营概览与待办',
    to: '/',
    icon: LayoutDashboard,
  },
  {
    label: '门店管理',
    caption: '营业时间、桌台码、门店配置',
    to: '/stores',
    icon: Store,
  },
  {
    label: '商品与菜单',
    caption: '商品、分类、套餐、菜单版本',
    to: '/products',
    icon: Boxes,
  },
  {
    label: '点餐收银',
    caption: '前台点餐、会员折扣、支付结算',
    to: '/orders',
    icon: ShoppingCart,
  },
  {
    label: '用户与会员',
    caption: '会员等级、积分、优惠券资产',
    to: '/members',
    icon: ShieldCheck,
  },
  {
    label: '营销中心',
    caption: '活动、Banner、推荐位配置',
    to: '/marketing',
    icon: Megaphone,
  },
  {
    label: '统计分析',
    caption: '经营分析、商品排行、活动效果',
    to: '/analytics',
    icon: BarChart3,
  },
  {
    label: '仓库管理',
    caption: '库存、采购、出入库、盘点',
    to: '/warehouse',
    icon: Package,
  },
  {
    label: '财务结算',
    caption: '支付流水、退款、对账、结算',
    to: '/finance',
    icon: Wallet,
  },
  {
    label: '系统设置',
    caption: '账号角色、权限、主题与设备',
    to: '/settings',
    icon: Settings,
  },
]
