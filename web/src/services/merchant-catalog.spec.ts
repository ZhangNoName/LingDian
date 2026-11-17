import { expect, it, vi } from 'vitest'
const { requestData } = vi.hoisted(() => ({ requestData: vi.fn() }))
vi.mock('@/lib/api', () => ({ requestData }))
import {
  merchantCategories,
  createMerchantCategory,
  createMerchantProduct,
  updateMerchantProductDetails,
  updateMerchantProductStatus,
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
