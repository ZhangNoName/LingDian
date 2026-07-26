import type { AuthRole } from '@lingdian/contracts'

export type AdminPermission = 'users:read' | 'users:write' | 'logs:read' | 'profile:write'

const ROLE_PERMISSIONS: Record<AuthRole, readonly AdminPermission[]> = {
  SUPER_ADMIN: ['users:read', 'users:write', 'logs:read', 'profile:write'],
  ADMIN: ['users:read', 'users:write', 'profile:write'],
  MERCHANT: ['profile:write'],
  USER: ['profile:write'],
}

export function hasPermission(roles: AuthRole[], permission: AdminPermission): boolean {
  return roles.some((role) => ROLE_PERMISSIONS[role].includes(permission))
}

export function firstAccessibleRoute(roles: AuthRole[]): string {
  if (hasPermission(roles, 'users:read')) return '/accounts/admins'
  if (hasPermission(roles, 'logs:read')) return '/system/logs'
  return '/profile'
}
