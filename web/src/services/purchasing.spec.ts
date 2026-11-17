import { expect, it, vi } from 'vitest'
const { requestData } = vi.hoisted(() => ({ requestData: vi.fn() }))
vi.mock('@/lib/api', () => ({ requestData }))
import {
  purchaseList,
  purchaseReceipts,
  receivePurchase,
  createPurchase,
  saveSupplier,
  purchaseReport,
  replenishmentSnapshot,
} from './purchasing'
it('scopes purchase filters, receipt pages and mutations to encoded store/object ids', async () => {
  await purchaseList('store/a', 2, ' Flour & milk ', 'PARTIAL')
  let url = new URL(requestData.mock.calls.at(-1)![0])
  expect(url.pathname).toContain('/store%2Fa/inventory/purchases')
  expect(Object.fromEntries(url.searchParams)).toMatchObject({
    page: '2',
    status: 'PARTIAL',
    keyword: ' Flour & milk ',
  })
  await purchaseReceipts('store/a', 'purchase/1', 3)
  url = new URL(requestData.mock.calls.at(-1)![0])
  expect(url.pathname).toContain('/purchases/purchase%2F1/receipts')
  expect(url.searchParams.get('page')).toBe('3')
  const body = {
    requestId: 'one-retry-key',
    expectedVersion: 3,
    note: 'Accepted',
    lines: [{ lineId: 'line-1', quantity: 1.125 }],
  }
  await receivePurchase('store/a', 'purchase/1', body)
  const [target, init] = requestData.mock.calls.at(-1)!
  expect(target).toContain('purchase%2F1/receipts')
  expect(JSON.parse(init.body)).toEqual(body)
  expect(init.method).toBe('POST')
  await createPurchase('store/a', {
    requestId: 'same-key',
    supplierId: 'supplier',
    note: '',
    lines: [{ itemId: 'i', quantity: 1, unitPrice: 1.23 }],
  })
  expect(JSON.parse(requestData.mock.calls.at(-1)![1].body).requestId).toBe('same-key')
  await saveSupplier(
    'store/a',
    { code: 'S', name: 'Supplier', contact: '', note: '', isActive: false },
    'supplier/1',
    4,
  )
  expect(requestData.mock.calls.at(-1)![1].method).toBe('PUT')
  expect(JSON.parse(requestData.mock.calls.at(-1)![1].body).expectedVersion).toBe(4)
})

it('requests complete scoped analysis snapshots with exact receipt instants and material filters', async () => {
  const filter = {
    startAt: '2026-01-01T10:30:00+08:00',
    endAt: '2026-02-01T10:30:00+08:00',
    supplierId: 's/1',
    itemId: 'i/1',
    keyword: 'Flour & milk',
  }
  await purchaseReport('store/a', filter)
  let url = new URL(requestData.mock.calls.at(-1)![0])
  expect(url.pathname).toContain('/store%2Fa/inventory/purchases/report')
  expect(Object.fromEntries(url.searchParams)).toEqual(filter)
  expect(url.searchParams.has('page')).toBe(false)
  await replenishmentSnapshot('store/a', { itemId: 'i/1' })
  url = new URL(requestData.mock.calls.at(-1)![0])
  expect(url.pathname).toContain('/store%2Fa/inventory/purchases/replenishment')
  expect(url.searchParams.get('itemId')).toBe('i/1')
  await purchaseList('store/a', 3, 'Supplier & flour', 'ACTIVE', 'i/1')
  url = new URL(requestData.mock.calls.at(-1)![0])
  expect(Object.fromEntries(url.searchParams)).toEqual({
    page: '3',
    pageSize: '20',
    keyword: 'Supplier & flour',
    status: 'ACTIVE',
    pendingItemId: 'i/1',
  })
})
