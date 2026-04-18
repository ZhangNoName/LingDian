import { createRouter, createWebHistory } from 'vue-router'
import AdminLayout from './layouts/AdminLayout.vue'
import AnalyticsView from './views/AnalyticsView.vue'
import DashboardView from './views/DashboardView.vue'
import FinanceView from './views/FinanceView.vue'
import MarketingView from './views/MarketingView.vue'
import MembersView from './views/MembersView.vue'
import OrdersView from './views/OrdersView.vue'
import ProductsView from './views/ProductsView.vue'
import SettingsView from './views/SettingsView.vue'
import StoresView from './views/StoresView.vue'
import WarehouseView from './views/WarehouseView.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      component: AdminLayout,
      children: [
        {
          path: '',
          name: 'dashboard',
          component: DashboardView,
          meta: { title: '工作台' },
        },
        {
          path: 'stores',
          name: 'stores',
          component: StoresView,
          meta: { title: '门店管理' },
        },
        {
          path: 'products',
          name: 'products',
          component: ProductsView,
          meta: { title: '商品与菜单' },
        },
        {
          path: 'orders',
          name: 'orders',
          component: OrdersView,
          meta: { title: '订单中心' },
        },
        {
          path: 'members',
          name: 'members',
          component: MembersView,
          meta: { title: '用户与会员' },
        },
        {
          path: 'marketing',
          name: 'marketing',
          component: MarketingView,
          meta: { title: '营销中心' },
        },
        {
          path: 'analytics',
          name: 'analytics',
          component: AnalyticsView,
          meta: { title: '统计分析' },
        },
        {
          path: 'warehouse',
          name: 'warehouse',
          component: WarehouseView,
          meta: { title: '仓库管理' },
        },
        {
          path: 'finance',
          name: 'finance',
          component: FinanceView,
          meta: { title: '财务结算' },
        },
        {
          path: 'settings',
          name: 'settings',
          component: SettingsView,
          meta: { title: '系统设置' },
        },
      ],
    },
  ],
})
