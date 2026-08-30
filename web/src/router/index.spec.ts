import { describe, expect, it } from 'vitest'
import { router } from './index'

describe('merchant router', () => {
  it('registers only implemented business modules by default', () => {
    expect(router.hasRoute('dashboard')).toBe(true)
    expect(router.hasRoute('stores')).toBe(true)
    expect(router.hasRoute('products')).toBe(true)
    expect(router.hasRoute('orders')).toBe(true)
    expect(router.hasRoute('settings')).toBe(true)

    for (const route of ['members', 'marketing', 'analytics', 'warehouse', 'finance']) {
      expect(router.hasRoute(route)).toBe(false)
    }
  })

  it('sends unknown direct links through the safe fallback route', () => {
    const resolved = router.resolve('/members')
    expect(resolved.matched).toHaveLength(1)
    expect(resolved.matched[0]?.redirect).toBe('/')
  })
})
