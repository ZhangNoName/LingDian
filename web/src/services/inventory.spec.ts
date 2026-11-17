import { beforeEach, describe, expect, it, vi } from 'vitest'
const { requestData } = vi.hoisted(() => ({ requestData: vi.fn() }))
vi.mock('@/lib/api', () => ({ requestData }))
import { getInventoryReport, listInventoryMovements } from './inventory'

describe('inventory report and history requests', () => {
  beforeEach(() => requestData.mockReset())
  it('encodes store and filter values and retains instant offsets', async () => {
    await listInventoryMovements('store/a', 2, { itemId: 'item/1', startAt: '2026-11-01T00:00:00+08:00', endAt: '2026-11-08T00:00:00+08:00', kind: 'LOSS', keyword: 'Milk & cream' })
    const url = new URL(requestData.mock.calls[0]![0])
    expect(url.pathname).toContain('/store%2Fa/inventory/movements')
    expect(Object.fromEntries(url.searchParams)).toMatchObject({ page: '2', itemId: 'item/1', kind: 'LOSS', keyword: 'Milk & cream', startAt: '2026-11-01T00:00:00+08:00' })
  })
  it('requests the full server snapshot without paging', async () => {
    await getInventoryReport('store-b', { startAt: '2026-11-01T00:00:00Z', endAt: '2026-11-08T00:00:00Z' })
    const url = new URL(requestData.mock.calls[0]![0])
    expect(url.pathname).toContain('/store-b/inventory/report')
    expect(url.searchParams.has('page')).toBe(false)
  })
})
