import { describe, expect, it } from 'vitest'
import { createNavigationState } from './navigation-state'

describe('merchant navigation state', () => {
  it('keeps desktop collapse and mobile drawer state independent', () => {
    const navigation = createNavigationState()

    navigation.toggleDesktop()
    navigation.openMobile()

    expect(navigation.isDesktopCollapsed.value).toBe(true)
    expect(navigation.isMobileOpen.value).toBe(true)

    navigation.closeMobile()

    expect(navigation.isDesktopCollapsed.value).toBe(true)
    expect(navigation.isMobileOpen.value).toBe(false)
  })

  it('starts with the desktop sidebar expanded and mobile drawer closed', () => {
    const navigation = createNavigationState()

    expect(navigation.isDesktopCollapsed.value).toBe(false)
    expect(navigation.isMobileOpen.value).toBe(false)
  })
})
