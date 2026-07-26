import { beforeEach, describe, expect, it, vi } from 'vitest'
const { request } = vi.hoisted(() => ({ request: vi.fn() }))
vi.mock('../auth/api-client', () => ({ adminRequest: request }))
import { changeCurrentPassword, createUser, listStoreOptions, listUsers, resetUserPassword, setUserStatus, updateUser } from './admin-users'

describe('admin users service', () => {
  beforeEach(() => request.mockReset().mockResolvedValue({ items: [], page: 1, pageSize: 20, total: 0 }))
  it('serializes defined filters and encodes keyword values', async () => {
    await listUsers({ page: 1, pageSize: 20, keyword: '张 三', role: 'USER' })
    expect(request.mock.calls[0]?.[0]).toBe('/admin/users?page=1&pageSize=20&keyword=%E5%BC%A0+%E4%B8%89&role=USER')
  })
  it('uses the dedicated status endpoint without deletion', async () => {
    await setUserStatus('user-1', 'DISABLED')
    expect(request).toHaveBeenCalledWith('/admin/users/user-1/status', { method: 'PATCH', body: JSON.stringify({ status: 'DISABLED' }) })
  })
  it('uses typed mutation endpoints for create, edit, reset, and current password change', async () => {
    const create = { username: 'manager', phone: '13800000000', password: 'strong-password', roles: ['USER'] as const, storeIds: [] }
    await createUser(create as never)
    await updateUser('user-1', { nickname: '店长' })
    await resetUserPassword('user-1', 'replacement-password')
    await changeCurrentPassword('old-password', 'replacement-password')
    expect(request.mock.calls.slice(-4)).toEqual([
      ['/admin/users', { method: 'POST', body: JSON.stringify(create) }],
      ['/admin/users/user-1', { method: 'PATCH', body: JSON.stringify({ nickname: '店长' }) }],
      ['/admin/users/user-1/password-reset', { method: 'POST', body: JSON.stringify({ password: 'replacement-password' }) }],
      ['/auth/account/password-change', { method: 'POST', body: JSON.stringify({ currentPassword: 'old-password', password: 'replacement-password' }) }],
    ])
  })
  it('loads store options for merchant scope fields', async () => {
    await listStoreOptions()
    expect(request).toHaveBeenLastCalledWith('/admin/users/options/stores')
  })
})
