import type { AuthRole } from '@lingdian/contracts'

export function canManageMerchants(roles: AuthRole[]): boolean {
  return roles.includes('SUPER_ADMIN')
}
