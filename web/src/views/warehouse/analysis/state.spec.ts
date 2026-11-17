import { expect, it } from 'vitest'
import { analysisQuery, parseAnalysisState } from './state'
it('round-trips analysis filters and focus without storing tenant identity or accepting arrays as selections', () => {
  const state = { subset: 'COUNT' as const, order: 'LOSS_RATE' as const, itemId: 'material/a' }
  expect(parseAnalysisState(analysisQuery(state))).toEqual(state)
  expect(analysisQuery(state)).not.toHaveProperty('storeId')
  expect(parseAnalysisState({ analysisSubset: 'bad', analysisOrder: ['LOSS_RATE'], analysisItem: ['a'] })).toEqual({
    subset: 'ALL',
    order: 'CODE',
    itemId: '',
  })
  expect(parseAnalysisState({ analysisItem: 'a'.repeat(192) }).itemId).toBe('')
})
