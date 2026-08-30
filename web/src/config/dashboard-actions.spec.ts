import { describe, expect, it } from 'vitest'
import { createNavigationItems, dashboardActions, navigationItems } from './navigation'

describe('dashboard actions', () => {
  it('links every quick action to an existing merchant navigation destination', () => {
    const destinations = new Set(navigationItems.map((item) => item.to))

    expect(dashboardActions).toHaveLength(4)
    expect(dashboardActions.every((action) => destinations.has(action.to))).toBe(true)
  })

  it('presents the single-store destination as settings rather than a store list', () => {
    expect(navigationItems.find((item) => item.to === '/stores')).toMatchObject({
      label: '门店设置',
      caption: '当前门店信息与营业状态',
    })
  })

  it('hides planned modules from the production navigation by default', () => {
    expect(navigationItems.map((item) => item.to)).not.toContain('/members')
    expect(createNavigationItems(true).map((item) => item.to)).toContain('/members')
  })
})
