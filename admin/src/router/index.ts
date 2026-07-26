import { ElMessage } from 'element-plus'
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { firstAccessibleRoute, hasPermission, type AdminPermission } from '../auth/permissions'
import { adminSession } from '../auth/session'
import AdminLayout from '../layouts/AdminLayout.vue'
import LoginView from '../views/LoginView.vue'
import PasswordChangeView from '../views/PasswordChangeView.vue'
import { mandatoryPasswordRoute } from './access'
declare module 'vue-router' { interface RouteMeta { title?: string; permission?: AdminPermission; public?: boolean; layout?: 'list' | 'scroll' } }
const routes: RouteRecordRaw[] = [
  { path: '/login', component: LoginView, meta: { public: true, title: '登录' } },
  { path: '/password-change', component: PasswordChangeView, meta: { title: '修改临时密码' } },
  { path: '/', component: AdminLayout, children: [
    { path: '', redirect: '/users' },
    { path: 'users', component: () => import('../views/users/UserManagementView.vue'), meta: { title: '用户管理', permission: 'users:read', layout: 'list' } },
    { path: 'system/logs', component: () => import('../views/logs/SystemLogsView.vue'), meta: { title: '系统日志', permission: 'logs:read', layout: 'list' } },
    { path: 'profile', component: () => import('../views/ProfileView.vue'), meta: { title: '个人设置', permission: 'profile:write', layout: 'scroll' } },
  ] },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]
export const router = createRouter({ history: createWebHistory(), routes })
router.beforeEach(async (to) => {
  if (to.meta.public) { if (to.path === '/login' && await adminSession.ensureAccessToken()) return firstAccessibleRoute(adminSession.currentUser.value?.roles ?? []); return true }
  if (!await adminSession.ensureAccessToken()) return { path: '/login', query: { redirect: to.fullPath } }
  const passwordRoute = mandatoryPasswordRoute(adminSession.currentUser.value, to.path)
  if (passwordRoute) return passwordRoute
  const roles = adminSession.currentUser.value?.roles ?? []
  if (to.path === '/') return firstAccessibleRoute(roles)
  if (to.meta.permission && !hasPermission(roles, to.meta.permission)) { ElMessage.warning('你没有访问该模块的权限'); return firstAccessibleRoute(roles) }
  return true
})
