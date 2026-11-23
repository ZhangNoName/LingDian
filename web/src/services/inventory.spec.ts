import { beforeEach, describe, expect, it, vi } from 'vitest'
const { requestData } = vi.hoisted(() => ({ requestData: vi.fn() }))
vi.mock('@/lib/api', () => ({ requestData }))
import { inventoryDailyTrend, inventoryMaterialChanges, renameInventoryMaterial, getInventoryAlert, getInventoryUsage, getInventoryRecipe, changeInventoryLifecycle, inventoryItemDetail, listInventory, getInventoryReport, listInventoryMovements, listInventoryAlerts, acknowledgeInventoryAlert } from './inventory'

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

it('addresses related records and exact recipe details with encoded store/object ids and bounded page state', async () => {
  await getInventoryUsage('store/a', 'item/1', 'STOCKTAKES', 3)
  const url = new URL(requestData.mock.calls.at(-1)![0])
  expect(url.pathname).toContain('/store%2Fa/inventory/items/item%2F1/usage')
  expect(Object.fromEntries(url.searchParams)).toEqual({ view: 'STOCKTAKES', page: '3' })
  await getInventoryRecipe('store/a', 'sku/1')
  expect(requestData.mock.calls.at(-1)![0]).toContain('/store%2Fa/inventory/recipes/sku%2F1')
})

it('loads an exact alert by encoded store and id independently of list filters', async () => {
  await getInventoryAlert('store/a', 'alert/1 & 2')
  const url = new URL(requestData.mock.calls.at(-1)![0])
  expect(url.pathname).toContain('/store%2Fa/inventory/alerts/alert%2F1%20%26%202')
  expect(url.search).toBe('')
})

it('scopes name-only writes and fixed-page change history without accepting quantity or unit changes', async () => {
  const body = { name: 'Corrected name', expectedVersion: 4, reason: 'Spelling' }
  await renameInventoryMaterial('store/a', 'item/1', body)
  const [target, init] = requestData.mock.calls.at(-1)!
  expect(target).toContain('/store%2Fa/inventory/items/item%2F1/name')
  expect(init.method).toBe('PUT'); expect(JSON.parse(init.body)).toEqual(body)
  await inventoryMaterialChanges('store/a', 'item/1', 'RESTORE', 2)
  const url = new URL(requestData.mock.calls.at(-1)![0])
  expect(url.pathname).toContain('/store%2Fa/inventory/items/item%2F1/changes')
  expect(Object.fromEntries(url.searchParams)).toEqual({ kind: 'RESTORE', page: '2' })
})

it('requests one material daily snapshot with exact instants or calendar dates and explicit zone', async () => {
  await inventoryDailyTrend('store/a','item/1', {startAt:'2026-03-01T00:00:00.123+08:00',endAt:'2026-03-31T12:00:00.456Z',timeZone:'America/New_York'})
  let url=new URL(requestData.mock.calls.at(-1)![0])
  expect(url.pathname).toContain('/store%2Fa/inventory/items/item%2F1/trend')
  expect(Object.fromEntries(url.searchParams)).toEqual({startAt:'2026-03-01T00:00:00.123+08:00',endAt:'2026-03-31T12:00:00.456Z',timeZone:'America/New_York'})
  await inventoryDailyTrend('store/a','item/1',{fromDate:'2026-03-07',toDate:'2026-03-09',timeZone:'America/New_York'})
  url=new URL(requestData.mock.calls.at(-1)![0]);expect(Object.fromEntries(url.searchParams)).toEqual({fromDate:'2026-03-07',toDate:'2026-03-09',timeZone:'America/New_York'})
})
