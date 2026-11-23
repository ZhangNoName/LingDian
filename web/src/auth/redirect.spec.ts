import { describe, expect, it } from 'vitest'
import { safeInternalRedirect } from './redirect'

describe('safe internal redirect', () => {
  it('keeps an internal path including its query', () => {
    expect(safeInternalRedirect('/orders?page=2')).toBe('/orders?page=2')
  })

  it.each(['https://example.test', '//example.test/path', '/\\example.test/path', 'orders'])
    ('rejects a non-local redirect: %s', (value) => {
      expect(safeInternalRedirect(value)).toBe('/')
    })
})
