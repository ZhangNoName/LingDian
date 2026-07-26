import { describe, expect, it } from 'vitest'
import { firstAccessibleRoute, hasPermission } from './permissions'

describe('admin permissions', () => {
  it('gives super administrators platform users, logs, and profile access', () => {
    expect(hasPermission(['SUPER_ADMIN'], 'users:read')).toBe(true)
    expect(hasPermission(['SUPER_ADMIN'], 'logs:read')).toBe(true)
    expect(hasPermission(['SUPER_ADMIN'], 'profile:write')).toBe(true)
  })

  it('keeps logs restricted while every admin audience can edit its profile', () => {
    expect(hasPermission(['ADMIN'], 'users:read')).toBe(true)
    expect(hasPermission(['ADMIN'], 'logs:read')).toBe(false)
    expect(hasPermission(['MERCHANT'], 'profile:write')).toBe(true)
    expect(firstAccessibleRoute(['MERCHANT'])).toBe('/profile')
    expect(firstAccessibleRoute(['ADMIN'])).toBe('/accounts/admins')
  })
})
