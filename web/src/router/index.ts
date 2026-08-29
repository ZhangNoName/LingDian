import { createRouter, createWebHistory } from 'vue-router'
import { merchantSession } from '@/auth/session'
import AdminLayout from '@/layouts/admin-layout/index.vue'
import LoginPage from '@/views/auth/login.vue'
import ForgotPasswordPage from '@/views/auth/forgot-password.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: LoginPage, meta: { title: '商家登录', public: true } },
    { path: '/forgot-password', name: 'forgot-password', component: ForgotPasswordPage, meta: { title: '忘记密码', public: true } },
    {
      path: '/',
      component: AdminLayout,
      children: [
        { path: '', name: 'dashboard', component: () => import('@/views/dashboard/index.vue'), meta: { title: '工作台' } },
        { path: 'stores', name: 'stores', component: () => import('@/views/stores/index.vue'), meta: { title: '门店设置' } },
        { path: 'products', name: 'products', component: () => import('@/views/products/index.vue'), meta: { title: '商品与菜单' } },
        { path: 'orders', name: 'orders', component: () => import('@/views/orders/index.vue'), meta: { title: '订单管理' } },
        { path: 'members', name: 'members', component: () => import('@/views/members/index.vue'), meta: { title: '用户与会员' } },
        { path: 'marketing', name: 'marketing', component: () => import('@/views/marketing/index.vue'), meta: { title: '营销中心' } },
        { path: 'analytics', name: 'analytics', component: () => import('@/views/analytics/index.vue'), meta: { title: '统计分析' } },
        { path: 'warehouse', name: 'warehouse', component: () => import('@/views/warehouse/index.vue'), meta: { title: '仓库管理' } },
        { path: 'finance', name: 'finance', component: () => import('@/views/finance/index.vue'), meta: { title: '财务结算' } },
        { path: 'settings', name: 'settings', component: () => import('@/views/settings/index.vue'), meta: { title: '系统设置' } },
        { path: 'profile/nickname', name: 'profile-nickname', component: () => import('@/views/profile/nickname.vue'), meta: { title: '设置昵称' } },
        { path: 'password/change', name: 'change-password', component: () => import('@/views/auth/change-password.vue'), meta: { title: '修改密码' } },
      ],
    },
  ],
})

router.beforeEach(async (to) => {
  if (to.meta.public) return true
  if (await merchantSession.ensureAccessToken()) {
    if (merchantSession.getUser()?.mustChangePassword && to.name !== 'change-password') {
      return { name: 'change-password' }
    }
    return true
  }
  return { name: 'login', query: { redirect: to.fullPath } }
})
