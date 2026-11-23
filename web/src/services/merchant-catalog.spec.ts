import { expect, it, vi } from 'vitest'
const { requestData } = vi.hoisted(() => ({ requestData: vi.fn() }))
vi.mock('@/lib/api', () => ({ requestData }))
import {
  merchantCategories,
  createMerchantCategory,
  createMerchantProduct,
  updateMerchantProductDetails,
  updateMerchantProductStatus,
  updateMerchantCategory,
} from './products'
it('scopes category/draft/metadata/status requests to encoded selected-store paths and keeps version/retry keys', async () => {
  await merchantCategories('store/a', 'Bread & milk', 'category/1')
  let url = new URL(requestData.mock.calls.at(-1)![0])
  expect(url.pathname).toContain('/store%2Fa/categories')
  expect(Object.fromEntries(url.searchParams)).toMatchObject({
    keyword: 'Bread & milk',
    categoryId: 'category/1',
    pageSize: '50',
  })
  await createMerchantCategory('store/a', 'Bakery')
  expect(JSON.parse(requestData.mock.calls.at(-1)![1].body)).toEqual({ name: 'Bakery' })
  const body = {
    requestId: 'same-retry-key',
    category_id: 'c1',
    name: 'Bread',
    description: '',
    price: 12.35,
    sku_name: 'Regular',
    is_featured: false,
  }
  await createMerchantProduct('store/a', body)
  expect(JSON.parse(requestData.mock.calls.at(-1)![1].body)).toEqual(body)
  await updateMerchantProductDetails('store/a', 'product/1', {
    expected_version: 3,
    category_id: 'c1',
    name: 'Renamed',
    description: '',
    is_featured: true,
  })
  expect(requestData.mock.calls.at(-1)![0]).toContain('/products/product%2F1/details')
  expect(JSON.parse(requestData.mock.calls.at(-1)![1].body).expected_version).toBe(3)
  await updateMerchantProductStatus('store/a', 'product/1', { expected_version: 4, status: 'ACTIVE' })
  expect(JSON.parse(requestData.mock.calls.at(-1)![1].body)).toEqual({ expected_version: 4, status: 'ACTIVE' })
  expect(requestData.mock.calls.at(-1)![1].method).toBe('PATCH')
})

it('encodes paginated category searches and category versions without widening store scope', async () => {
  await merchantCategories('store/a', 'Tea & coffee', '', 3)
  let url = new URL(requestData.mock.calls.at(-1)![0])
  expect(Object.fromEntries(url.searchParams)).toMatchObject({ page: '3', pageSize: '50', keyword: 'Tea & coffee' })
  const body = { expected_version: 4, name: 'Drinks', sort_order: 20, is_visible: false }
  await updateMerchantCategory('store/a', 'category/1', body)
  const [target, init] = requestData.mock.calls.at(-1)!
  url = new URL(target)
  expect(url.pathname).toContain('/store%2Fa/categories/category%2F1')
  expect(init.method).toBe('PATCH')
  expect(JSON.parse(init.body)).toEqual(body)
})
