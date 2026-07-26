import { describe, expect, it } from 'vitest'
import { router } from './index'

describe('admin route scroll ownership', () => {
  it('marks list routes for internal table scrolling and ordinary pages for content scrolling', () => {
    expect(router.resolve('/accounts/admins').meta).toMatchObject({ layout: 'list', accountType: 'ADMINISTRATOR' })
    expect(router.resolve('/accounts/merchants').meta).toMatchObject({ layout: 'list', accountType: 'MERCHANT' })
    expect(router.resolve('/accounts/users').meta).toMatchObject({ layout: 'list', accountType: 'USER' })
    expect(router.resolve('/users').matched.at(-1)?.redirect).toBe('/accounts/admins')
    expect(router.resolve('/system/logs').meta.layout).toBe('list')
    expect(router.resolve('/profile').meta.layout).toBe('scroll')
  })
})
