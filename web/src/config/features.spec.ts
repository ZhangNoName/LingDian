import { describe, expect, it } from 'vitest'
import { isPlannedModulesEnabled } from './features'

describe('merchant feature flags', () => {
  it('keeps planned modules disabled unless explicitly enabled', () => {
    expect(isPlannedModulesEnabled(undefined)).toBe(false)
    expect(isPlannedModulesEnabled('false')).toBe(false)
    expect(isPlannedModulesEnabled('true')).toBe(true)
  })
})
