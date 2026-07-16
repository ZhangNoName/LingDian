import { expect, it } from 'vitest'
import { merchantLoginPasswordMinimum, merchantPasswordReplacementMinimum } from './password-policy'

it('allows bootstrap-compatible merchant login passwords while retaining the replacement-password minimum', () => {
  expect(merchantLoginPasswordMinimum).toBe(8)
  expect(merchantPasswordReplacementMinimum).toBe(12)
})
