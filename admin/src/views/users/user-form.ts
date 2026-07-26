import type { AuthRole } from '@lingdian/contracts'

export type UserFormState = {
  nickname: string
  username: string
  phone: string
  password: string
  roles: AuthRole[]
  storeIds: string[]
}

export function validateUserForm(form: UserFormState, creating: boolean): string[] {
  const errors: string[] = []
  if (!/^[a-z0-9._-]{3,64}$/.test(form.username.trim().toLowerCase())) errors.push('账号格式应为 3–64 位小写字母、数字或 ._-')
  if (!form.phone.trim()) errors.push('请输入手机号')
  if (creating && form.password.length < 12) errors.push('初始密码至少 12 位')
  if (form.roles.length === 0) errors.push('至少选择一个角色')
  if (form.roles.includes('MERCHANT') && form.storeIds.length === 0) errors.push('商家角色至少选择一个门店')
  return errors
}

export function normalizeUserForm(form: UserFormState): UserFormState {
  return {
    ...form,
    nickname: form.nickname.trim(),
    username: form.username.trim().toLowerCase(),
    phone: form.phone.trim(),
    roles: [...new Set(form.roles)],
    storeIds: form.roles.includes('MERCHANT') ? [...new Set(form.storeIds)] : [],
  }
}
