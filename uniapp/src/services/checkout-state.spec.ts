import { describe, expect, it } from 'vitest'
import { canCheckout, canSubmitCheckout } from './checkout-state'

describe('checkout state', () => {
  it('allows checkout only when the cart contains at least one item', () => {
    expect(canCheckout({ itemCount: 0 })).toBe(false)
    expect(canCheckout({ itemCount: 1 })).toBe(true)
  })

  it('requires an address only for delivery checkout', () => {
    expect(canSubmitCheckout({ itemCount: 1, serviceMode: 'dineIn' })).toBe(true)
    expect(canSubmitCheckout({ itemCount: 1, serviceMode: 'takeaway' })).toBe(true)
    expect(canSubmitCheckout({ itemCount: 1, serviceMode: 'delivery' })).toBe(false)
    expect(canSubmitCheckout({ itemCount: 1, serviceMode: 'delivery', addressId: 'address-1' })).toBe(true)
    expect(canSubmitCheckout({ itemCount: 0, serviceMode: 'delivery', addressId: 'address-1' })).toBe(false)
  })

  it('allows a dine-in-only store to submit a dine-in order', () => {
    expect(canSubmitCheckout({
      itemCount: 1,
      serviceMode: 'dineIn',
      businessStatus: 'open',
      supportedModes: ['dineIn'],
    })).toBe(true)
  })

  it('blocks checkout when the store is closed or the mode is disabled', () => {
    expect(canSubmitCheckout({
      itemCount: 1,
      serviceMode: 'takeaway',
      businessStatus: 'closed',
      supportedModes: ['takeaway'],
    })).toBe(false)
    expect(canSubmitCheckout({
      itemCount: 1,
      serviceMode: 'takeaway',
      businessStatus: 'open',
      supportedModes: ['delivery'],
    })).toBe(false)
    expect(canSubmitCheckout({
      itemCount: 1,
      serviceMode: 'takeaway',
      businessStatus: 'open',
      supportedModes: ['takeaway'],
    })).toBe(true)
  })
})
