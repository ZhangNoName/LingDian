import { expect, it } from 'vitest'
import { materialId, replenishmentState, replenishmentFocus } from './replenishment-state'
it('keeps exact material focus separate from text search and shows covered materials reached from alerts', () => {
  expect(replenishmentState({})).toEqual({ itemId: '', keyword: '', subset: 'NEEDED' })
  expect(replenishmentState(replenishmentFocus('flour/a'))).toEqual({ itemId: 'flour/a', keyword: '', subset: 'ALL' })
  expect(
    replenishmentState({
      replenishmentItemId: ' flour ',
      replenishmentKeyword: ' milk ',
      replenishmentSubset: 'COVERED',
    }),
  ).toEqual({ itemId: 'flour', keyword: 'milk', subset: 'COVERED' })
  expect(materialId(['store-a', 'store-b'])).toBe('')
  expect(materialId('a'.repeat(192))).toBe('')
  expect(replenishmentState({ replenishmentSubset: 'invalid' }).subset).toBe('NEEDED')
  expect(replenishmentState({ replenishmentSubset: ['ALL'] }).subset).toBe('NEEDED')
})
