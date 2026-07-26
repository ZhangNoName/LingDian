import { describe, expect, it } from 'vitest'
import { router } from './index'

describe('admin route scroll ownership', () => {
  it('marks list routes for internal table scrolling and ordinary pages for content scrolling', () => {
    expect(router.resolve('/users').meta.layout).toBe('list')
    expect(router.resolve('/system/logs').meta.layout).toBe('list')
    expect(router.resolve('/profile').meta.layout).toBe('scroll')
  })
})
