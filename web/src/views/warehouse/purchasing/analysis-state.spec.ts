import { expect, it } from 'vitest'
import { receiptState, receiptQuery } from './analysis-state'
it('round trips exact report instants and scopes filters without carrying access claims', () => {
  const state = receiptState({
    receiptStartAt: '2026-11-01T10:30:00+08:00',
    receiptEndAt: '2026-11-02T10:30:00+08:00',
    receiptSupplierId: 's1',
    receiptItemId: 'i1',
    receiptKeyword: ' Flour ',
    storeId: 'foreign',
    token: 'secret',
  })
  expect(state.startAt).toBe('2026-11-01T02:30:00.000Z')
  expect(receiptState(receiptQuery(state))).toEqual(state)
  expect(receiptQuery(state)).not.toHaveProperty('storeId')
  expect(receiptQuery(state)).not.toHaveProperty('token')
})
it('repairs invalid links to a bounded default without retaining invalid ids', () => {
  const state = receiptState(
    {
      receiptStartAt: 'invalid',
      receiptEndAt: 'bad',
      receiptSupplierId: ['s1'],
      receiptItemId: [],
      receiptKeyword: ['all'],
    },
    new Date('2026-11-17T00:00:00Z'),
  )
  expect(Date.parse(state.endAt) - Date.parse(state.startAt)).toBe(30 * 86400000)
  expect(state.itemId).toBeUndefined()
  expect(state.supplierId).toBeUndefined()
  expect(state.keyword).toBeUndefined()
})
