import { describe, expect, it } from 'vitest'
import { navigationItems, visibleNavigationItems } from './navigation'

describe('admin navigation', () => {
  it('derives visible modules from roles', () => {
    expect(visibleNavigationItems(['SUPER_ADMIN']).map((item) => item.path)).toEqual(['/accounts', '/system/logs', '/profile'])
    expect(visibleNavigationItems(['ADMIN']).map((item) => item.path)).toEqual(['/accounts', '/profile'])
    expect(visibleNavigationItems(['MERCHANT']).map((item) => item.path)).toEqual(['/profile'])
  })

  it('groups the three account tables under account management', () => {
    expect(navigationItems[0]).toMatchObject({ path: '/accounts', label: '账号管理', icon: 'users' })
    expect(navigationItems[0]?.children?.map((item) => [item.path, item.label])).toEqual([
      ['/accounts/admins', '管理员账号'],
      ['/accounts/merchants', '商家账号'],
      ['/accounts/users', '普通用户'],
    ])
  })
})
