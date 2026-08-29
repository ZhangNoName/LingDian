import { beforeEach, describe, expect, it, vi } from 'vitest'

const { requestData } = vi.hoisted(() => ({ requestData: vi.fn() }))
vi.mock('@/lib/api', () => ({ requestData }))

import { listMerchantStores, listStoreIntegrations, setStoreIntegrationEnabled } from './integrations'

describe('merchant integration service', () => {
  beforeEach(() => requestData.mockReset())

  it('keeps the merchant store endpoint as an array-compatible source', async () => {
    requestData.mockResolvedValue([{ id: 'store-1', code: 'primary', name: '中心店', status: 'OPEN' }])

    const stores = await listMerchantStores()

    expect(requestData).toHaveBeenCalledWith(expect.stringMatching(/\/api\/merchant\/stores$/))
    expect(stores).toHaveLength(1)
  })

  it('encodes store ids when loading optional capabilities', async () => {
    requestData.mockResolvedValue([])
    await listStoreIntegrations('store/with spaces')
    expect(requestData).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/merchant\/stores\/store%2Fwith%20spaces\/integrations$/),
    )
  })

  it('uses the stable provider id and explicit boolean when changing a switch', async () => {
    requestData.mockResolvedValue({ provider: 'MEITUAN_WAIMAI', enabled: true })
    await setStoreIntegrationEnabled('store-1', 'MEITUAN_WAIMAI', true)
    expect(requestData).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/merchant\/stores\/store-1\/integrations\/MEITUAN_WAIMAI$/),
      expect.objectContaining({ method: 'PATCH', body: '{"enabled":true}' }),
    )
  })
})
