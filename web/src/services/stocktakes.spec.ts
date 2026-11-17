import { expect, it, vi } from 'vitest'
const { requestData } = vi.hoisted(() => ({ requestData: vi.fn() }))
vi.mock('@/lib/api', () => ({ requestData }))
import { listStocktakes, getStocktake, saveStocktake, stocktakeAction, createStocktake } from './stocktakes'
it('encodes stocktake store/object scope, keeps version and nullable zero counts, and uses explicit actions', async () => {
  await listStocktakes('store/a', 2, ' Closing & morning ', 'DRAFT')
  let url = new URL(requestData.mock.calls.at(-1)![0])
  expect(url.pathname).toContain('/store%2Fa/inventory/stocktakes')
  expect(Object.fromEntries(url.searchParams)).toMatchObject({
    page: '2',
    keyword: ' Closing & morning ',
    status: 'DRAFT',
  })
  await getStocktake('store/a', 'count/1')
  expect(requestData.mock.calls.at(-1)![0]).toContain('/stocktakes/count%2F1')
  const body = {
    expectedVersion: 2,
    lines: [
      { lineId: 'a', countedQuantity: null },
      { lineId: 'b', countedQuantity: 0 },
    ],
  }
  await saveStocktake('store/a', 'count/1', body)
  expect(requestData.mock.calls.at(-1)![1].method).toBe('PUT')
  expect(JSON.parse(requestData.mock.calls.at(-1)![1].body)).toEqual(body)
  await stocktakeAction('store/a', 'count/1', 'post', 3)
  expect(requestData.mock.calls.at(-1)![0]).toContain('/count%2F1/post')
  expect(JSON.parse(requestData.mock.calls.at(-1)![1].body)).toEqual({ expectedVersion: 3 })
  await createStocktake('store/a', { requestId: 'retry-key', title: 'Close', note: 'Shift', itemIds: ['a'] })
  expect(JSON.parse(requestData.mock.calls.at(-1)![1].body).requestId).toBe('retry-key')
})
