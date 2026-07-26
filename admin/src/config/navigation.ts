import type { AuthRole } from '@lingdian/contracts'
import type { AdminPermission } from '../auth/permissions'
import { hasPermission } from '../auth/permissions'

export type NavigationIcon = 'users' | 'logs' | 'profile'
export type NavigationItem = {
  path: string
  label: string
  icon?: NavigationIcon
  permission?: AdminPermission
  children?: NavigationItem[]
}

export const navigationItems: NavigationItem[] = [
  {
    path: '/accounts', label: '账号管理', icon: 'users', children: [
      { path: '/accounts/admins', label: '管理员账号', permission: 'users:read' },
      { path: '/accounts/merchants', label: '商家账号', permission: 'users:read' },
      { path: '/accounts/users', label: '普通用户', permission: 'users:read' },
    ],
  },
  { path: '/system/logs', label: '系统日志', icon: 'logs', permission: 'logs:read' },
  { path: '/profile', label: '个人设置', icon: 'profile', permission: 'profile:write' },
]

export function visibleNavigationItems(roles: AuthRole[]): NavigationItem[] {
  return navigationItems.flatMap((item) => {
    if (item.children) {
      const children = item.children.filter((child) => !child.permission || hasPermission(roles, child.permission))
      return children.length ? [{ ...item, children }] : []
    }
    return !item.permission || hasPermission(roles, item.permission) ? [item] : []
  })
}
