import { describe, expect, it } from 'vitest'
import type { MerchantStoreSummary } from '@/services/integrations'
import { getStoreStatusPresentation, resolveSingleStoreView } from './store-view'

const primaryStore: MerchantStoreSummary = {
  id: 'store-1',
  code: 'primary',
  name: '中心店',
  status: 'OPEN',
}

describe('single store view', () => {
  it('shows the only authorized store as the primary store', () => {
    expect(resolveSingleStoreView([primaryStore])).toEqual({ kind: 'ready', store: primaryStore })
  })

  it('keeps the array API safe for empty and unexpected multi-store responses', () => {
    expect(resolveSingleStoreView([])).toEqual({ kind: 'empty' })
    expect(resolveSingleStoreView([primaryStore, { ...primaryStore, id: 'store-2' }])).toEqual({
      kind: 'conflict',
      storeCount: 2,
    })
  })

  it('maps every backend store status to a clear Chinese label', () => {
    expect(getStoreStatusPresentation('OPEN').label).toBe('营业中')
    expect(getStoreStatusPresentation('CLOSED').label).toBe('已关闭')
    expect(getStoreStatusPresentation('RESTING').label).toBe('暂停营业')
  })
})
