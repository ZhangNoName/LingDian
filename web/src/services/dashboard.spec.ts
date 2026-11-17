import { it, expect, vi } from 'vitest'
const { requestData } = vi.hoisted(() => ({ requestData: vi.fn() }))
vi.mock('@/lib/api', () => ({ requestData }))
import { getMerchantDashboard, getStockHold, listStockHolds, recheckStockHold } from './dashboard'
it('encodes dashboard instants and scoped hold identifiers without overriding the session store', async () => {
  await getMerchantDashboard({ startAt: '2026-11-01T00:00:00+08:00', endAt: '2026-11-02T00:00:00+08:00' })
  expect(new URL(requestData.mock.calls.at(-1)![0]).searchParams.get('startAt')).toBe('2026-11-01T00:00:00+08:00')
  await listStockHolds(2, 'EXPIRED', 'LD & 1')
  expect(new URL(requestData.mock.calls.at(-1)![0]).searchParams.get('keyword')).toBe('LD & 1')
  await getStockHold('order/a', 3)
  expect(requestData.mock.calls.at(-1)![0]).toContain('/stock-holds/order%2Fa?page=3')
  await recheckStockHold('order/a')
  expect(requestData.mock.calls.at(-1)).toEqual([expect.stringContaining('/stock-holds/order%2Fa/recheck'), { method: 'POST' }])
})
