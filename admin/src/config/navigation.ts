import type { AuthRole } from '@lingdian/contracts'
import type { AdminPermission } from '../auth/permissions'
import { hasPermission } from '../auth/permissions'

export type NavigationItem = { path: string; label: string; icon: 'users' | 'logs' | 'profile'; permission: AdminPermission }

export const navigationItems: NavigationItem[] = [
  { path: '/users', label: '用户管理', icon: 'users', permission: 'users:read' },
  { path: '/system/logs', label: '系统日志', icon: 'logs', permission: 'logs:read' },
  { path: '/profile', label: '个人设置', icon: 'profile', permission: 'profile:write' },
]

export function visibleNavigationItems(roles: AuthRole[]): NavigationItem[] {
  return navigationItems.filter((item) => hasPermission(roles, item.permission))
}
