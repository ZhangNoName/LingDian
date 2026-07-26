import { describe, expect, it } from 'vitest'
import { normalizeUserForm, validateUserForm, type UserFormState } from './user-form'

const valid: UserFormState = { nickname: '店长', username: 'manager', phone: '13800000000', password: 'strong-password', roles: ['USER'], storeIds: [] }

describe('platform user form rules', () => {
  it('requires a store for merchant accounts', () => {
    expect(validateUserForm({ ...valid, roles: ['MERCHANT'] }, true).some((message) => message.includes('至少选择一个门店'))).toBe(true)
  })
  it('requires normalized account names and twelve-character create passwords', () => {
    expect(validateUserForm({ ...valid, username: 'BAD NAME' }, true).some((message) => message.includes('账号格式'))).toBe(true)
    expect(validateUserForm({ ...valid, password: 'short' }, true).some((message) => message.includes('至少 12 位'))).toBe(true)
  })
  it('removes store scope when merchant role is removed', () => {
    expect(normalizeUserForm({ ...valid, storeIds: ['store-1'] })).toEqual({ ...valid, storeIds: [] })
  })
})
