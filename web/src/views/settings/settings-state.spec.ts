import type { IntegrationCapabilityContract } from '@lingdian/contracts'
import { describe, expect, it, vi } from 'vitest'
import type { MerchantStoreSummary } from '@/services/integrations'
import { loadSingleStoreCapabilities } from './settings-state'

const primaryStore: MerchantStoreSummary = {
  id: 'store-primary',
  code: 'PRIMARY',
  name: '中心店',
  status: 'OPEN',
}

const cashierCapability: IntegrationCapabilityContract = {
  provider: 'CASHIER',
  display_name: '收银系统',
  category: 'CASHIER',
  available: true,
  enabled: false,
  store_id: primaryStore.id,
  reason: null,
}

describe('single-store integration settings', () => {
  it('loads integrations for the only authorized store', async () => {
    const loader = vi.fn().mockResolvedValue([cashierCapability])

    await expect(loadSingleStoreCapabilities([primaryStore], loader)).resolves.toEqual({
      storeState: { kind: 'ready', store: primaryStore },
      capabilities: [cashierCapability],
    })
    expect(loader).toHaveBeenCalledOnce()
    expect(loader).toHaveBeenCalledWith(primaryStore.id)
  })

  it('does not call the integration API when no store is authorized', async () => {
    const loader = vi.fn()

    await expect(loadSingleStoreCapabilities([], loader)).resolves.toEqual({
      storeState: { kind: 'empty' },
      capabilities: [],
    })
    expect(loader).not.toHaveBeenCalled()
  })

  it('does not silently choose the first store from an unexpected multi-store response', async () => {
    const loader = vi.fn()

    await expect(
      loadSingleStoreCapabilities([primaryStore, { ...primaryStore, id: 'store-secondary' }], loader),
    ).resolves.toEqual({
      storeState: { kind: 'conflict', storeCount: 2 },
      capabilities: [],
    })
    expect(loader).not.toHaveBeenCalled()
  })
})
