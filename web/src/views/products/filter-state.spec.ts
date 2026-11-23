import { it, expect } from 'vitest'
import { parseProductState, productStateQuery, productListKey } from './filter-state'
it('keeps catalogue filters and a configuration link without carrying tenant claims', () => {
  const state = parseProductState({
    keyword: ' Bread ',
    type: 'PACKAGE',
    page: '2',
    pageSize: '50',
    productId: 'p1',
    storeId: 'foreign',
  })
  expect(parseProductState(productStateQuery(state))).toEqual(state)
  expect(productListKey({ ...state, productId: '' })).toBe(productListKey(state))
  expect(productStateQuery(state)).not.toHaveProperty('storeId')
  expect(parseProductState({ type: ['PACKAGE'] }).type).toBe('')
  expect(productStateQuery(parseProductState({ type: 'ADMIN', page: '-1', pageSize: '999' }))).toEqual({})
})
