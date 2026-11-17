import { beforeEach, describe, expect, it, vi } from 'vitest'
const { requestData } = vi.hoisted(() => ({ requestData: vi.fn() }))
vi.mock('@/lib/api', () => ({ requestData }))
import { changeInventoryLifecycle, inventoryItemDetail, listInventory, getInventoryReport, listInventoryMovements, listInventoryAlerts, acknowledgeInventoryAlert } from './inventory'

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


it('keeps alert filters and acknowledgement within the selected store', async () => {
  await listInventoryAlerts('store/a', { page: 3, status: 'RESOLVED', severity: 'OUT', keyword: ' Flour & milk ' })
  let url = new URL(requestData.mock.calls.at(-1)![0])
  expect(url.pathname).toContain('/store%2Fa/inventory/alerts')
  expect(Object.fromEntries(url.searchParams)).toMatchObject({ page: '3', status: 'RESOLVED', severity: 'OUT', keyword: 'Flour & milk' })
  await acknowledgeInventoryAlert('store/a', 'alert/1', { expectedVersion: 2, note: 'Tomorrow' })
  const [target, init] = requestData.mock.calls.at(-1)!
  url = new URL(target)
  expect(url.pathname).toContain('/store%2Fa/inventory/alerts/alert%2F1/acknowledge')
  expect(init.method).toBe('POST')
  expect(JSON.parse(init.body)).toEqual({ expectedVersion: 2, note: 'Tomorrow' })
})

it('scopes lifecycle filtering and explicit versioned status changes without sending quantity writes', async () => {
  await listInventory('store/a', { page: 2, pageSize: 20, lifecycle: 'ARCHIVED' })
  let url = new URL(requestData.mock.calls.at(-1)![0])
  expect(url.pathname).toContain('/store%2Fa/inventory')
  expect(url.searchParams.get('lifecycle')).toBe('ARCHIVED')
  await inventoryItemDetail('store/a', 'item/1')
  expect(requestData.mock.calls.at(-1)![0]).toContain('/inventory/items/item%2F1')
  const body = { isActive: false, expectedVersion: 4, reason: 'Obsolete' }
  await changeInventoryLifecycle('store/a', 'item/1', body)
  const [target, init] = requestData.mock.calls.at(-1)!
  expect(target).toContain('/store%2Fa/inventory/items/item%2F1/lifecycle')
  expect(init.method).toBe('PUT')
  expect(JSON.parse(init.body)).toEqual(body)
})
