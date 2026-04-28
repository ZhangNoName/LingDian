import { createRouter, createWebHistory } from 'vue-router'
import AdminLayout from '@/layouts/admin-layout/index.vue'
import AnalyticsPage from '@/views/analytics/index.vue'
import DashboardPage from '@/views/dashboard/index.vue'
import FinancePage from '@/views/finance/index.vue'
import MarketingPage from '@/views/marketing/index.vue'
import MembersPage from '@/views/members/index.vue'
import OrdersPage from '@/views/orders/index.vue'
import ProductsPage from '@/views/products/index.vue'
import SettingsPage from '@/views/settings/index.vue'
import StoresPage from '@/views/stores/index.vue'
import WarehousePage from '@/views/warehouse/index.vue'

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
          component: DashboardPage,
          meta: { title: '工作台' },
        },
        {
          path: 'stores',
          name: 'stores',
          component: StoresPage,
          meta: { title: '门店管理' },
        },
        {
          path: 'products',
          name: 'products',
          component: ProductsPage,
          meta: { title: '商品与菜单' },
        },
        {
          path: 'orders',
          name: 'orders',
          component: OrdersPage,
          meta: { title: '订单管理' },
        },
        {
          path: 'members',
          name: 'members',
          component: MembersPage,
          meta: { title: '用户与会员' },
        },
        {
          path: 'marketing',
          name: 'marketing',
          component: MarketingPage,
          meta: { title: '营销中心' },
        },
        {
          path: 'analytics',
          name: 'analytics',
          component: AnalyticsPage,
          meta: { title: '统计分析' },
        },
        {
          path: 'warehouse',
          name: 'warehouse',
          component: WarehousePage,
          meta: { title: '仓库管理' },
        },
        {
          path: 'finance',
          name: 'finance',
          component: FinancePage,
          meta: { title: '财务结算' },
        },
        {
          path: 'settings',
          name: 'settings',
          component: SettingsPage,
          meta: { title: '系统设置' },
        },
      ],
    },
  ],
})
