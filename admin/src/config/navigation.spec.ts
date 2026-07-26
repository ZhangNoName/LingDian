import { describe, expect, it } from 'vitest'
import { navigationItems, visibleNavigationItems } from './navigation'

describe('admin navigation', () => {
  it('derives visible modules from roles', () => {
    expect(visibleNavigationItems(['SUPER_ADMIN']).map((item) => item.path)).toEqual(['/users', '/system/logs', '/profile'])
    expect(visibleNavigationItems(['ADMIN']).map((item) => item.path)).toEqual(['/users', '/profile'])
    expect(visibleNavigationItems(['MERCHANT']).map((item) => item.path)).toEqual(['/profile'])
  })

  it('gives every navigation item a route, label, icon and permission', () => {
    expect(navigationItems.every((item) => item.path && item.label && item.icon && item.permission)).toBe(true)
  })
})
