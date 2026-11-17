import { expect, it } from 'vitest'
import { inventoryLifecycleQuery } from './state'
it('retains stock-list lifecycle context without carrying tenant ids or malformed state', () => {
  expect(inventoryLifecycleQuery({ inventoryLifecycle: 'ARCHIVED', storeId: 'foreign' })).toEqual({
    inventoryLifecycle: 'ARCHIVED',
  })
  expect(inventoryLifecycleQuery({ inventoryLifecycle: ['ALL'] })).toEqual({})
  expect(inventoryLifecycleQuery({ inventoryLifecycle: 'ACTIVE' })).toEqual({})
})
