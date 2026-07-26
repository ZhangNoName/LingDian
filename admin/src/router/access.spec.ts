import { describe, expect, it } from 'vitest'
import { mandatoryPasswordRoute } from './access'

describe('mandatory password route', () => {
  it('redirects temporary-password sessions until they reach password change', () => {
    expect(mandatoryPasswordRoute({ mustChangePassword: true }, '/users')).toBe('/password-change')
    expect(mandatoryPasswordRoute({ mustChangePassword: true }, '/password-change')).toBeNull()
    expect(mandatoryPasswordRoute({ mustChangePassword: false }, '/users')).toBeNull()
  })
})
