import { describe, expect, it } from 'vitest'
import { canCheckout } from './checkout-state'

describe('checkout state', () => {
  it('allows checkout only when the cart contains at least one item', () => {
    expect(canCheckout({ itemCount: 0 })).toBe(false)
    expect(canCheckout({ itemCount: 1 })).toBe(true)
  })
})
