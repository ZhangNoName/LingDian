import type { AuthRole, PlatformAccountType } from '@lingdian/contracts'

export type AccountPageConfig = {
  createLabel: string
  entityLabel: string
  defaultRoles: AuthRole[]
  showStores: boolean
}

const configs: Record<PlatformAccountType, AccountPageConfig> = {
  ADMINISTRATOR: { createLabel: '新建管理员', entityLabel: '管理员', defaultRoles: ['ADMIN'], showStores: false },
  MERCHANT: { createLabel: '新建商家', entityLabel: '商家', defaultRoles: ['MERCHANT'], showStores: true },
  USER: { createLabel: '新建用户', entityLabel: '用户', defaultRoles: ['USER'], showStores: false },
}

export function accountPageConfig(accountType: PlatformAccountType): AccountPageConfig {
  return configs[accountType]
}
