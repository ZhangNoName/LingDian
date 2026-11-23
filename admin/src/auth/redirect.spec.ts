import { describe, expect, it } from 'vitest'
import { safeInternalRedirect } from './redirect'

describe('safeInternalRedirect', () => {
  it('accepts an internal route with its query string', () => {
    expect(safeInternalRedirect('/accounts/users?page=2', '/accounts/admins'))
      .toBe('/accounts/users?page=2')
  })

  it.each([
    'https://evil.example/path',
    '//evil.example/path',
    '/\\evil.example/path',
    'accounts/users',
  ])('rejects unsafe redirect %s', (redirect) => {
    expect(safeInternalRedirect(redirect, '/accounts/admins')).toBe('/accounts/admins')
  })
})
