import { describe, expect, it } from 'vitest'
import { canCheckout, canSubmitCheckout } from './checkout-state'

import type { StoreSummary } from '@/types/store'

const openStore: StoreSummary = {
  id: 's', name: '门店', businessText: '', distanceText: '',
  businessStatus: 'open', supportModes: ['dineIn', 'takeaway', 'delivery'],
}

describe('checkout state', () => {
  it('allows checkout only when the cart contains at least one item', () => {
    expect(canCheckout({ itemCount: 0 })).toBe(false)
    expect(canCheckout({ itemCount: 1 })).toBe(true)
  })

  it('requires an address only for delivery checkout', () => {
    expect(canSubmitCheckout({ store: openStore, itemCount: 1, serviceMode: 'dineIn' })).toBe(true)
    expect(canSubmitCheckout({ store: openStore, itemCount: 1, serviceMode: 'takeaway' })).toBe(true)
    expect(canSubmitCheckout({ store: openStore, itemCount: 1, serviceMode: 'delivery' })).toBe(false)
    expect(canSubmitCheckout({ store: openStore, itemCount: 1, serviceMode: 'delivery', addressId: 'address-1' })).toBe(true)
    expect(canSubmitCheckout({ store: openStore, itemCount: 0, serviceMode: 'delivery', addressId: 'address-1' })).toBe(false)
  })

  it('allows a dine-in-only store to submit a dine-in order', () => {
    expect(canSubmitCheckout({
      itemCount: 1,
      serviceMode: 'dineIn',
      store: { ...openStore, businessStatus: 'open', supportModes: ['dineIn'] },
    })).toBe(true)
  })

  it('waits for the actual store before accepting checkout', () => {
    expect(canSubmitCheckout({ store: null, itemCount: 1, serviceMode: 'takeaway' })).toBe(false)
  })

  it('blocks checkout when the store is closed or the mode is disabled', () => {
    expect(canSubmitCheckout({
      itemCount: 1,
      serviceMode: 'takeaway',
      store: { ...openStore, businessStatus: 'closed', supportModes: ['takeaway'] },
    })).toBe(false)
    expect(canSubmitCheckout({
      itemCount: 1,
      serviceMode: 'takeaway',
      store: { ...openStore, businessStatus: 'open', supportModes: ['delivery'] },
    })).toBe(false)
    expect(canSubmitCheckout({
      itemCount: 1,
      serviceMode: 'takeaway',
      store: { ...openStore, businessStatus: 'open', supportModes: ['takeaway'] },
    })).toBe(true)
  })
})
