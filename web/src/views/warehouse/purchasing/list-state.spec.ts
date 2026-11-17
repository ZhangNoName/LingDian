import { expect, it } from 'vitest'
import { dateInput } from '../activity-state'
import { dateCutoff, editedCutoff, isCanonicalList, listQuery, listTarget, parseListState } from './list-state'
it('round-trips purchase list filters and exact delivery cutoff independently of supplier filters', () => {
  const state = parseListState({
    purchaseKeyword: ' Flour ',
    purchasePage: '3',
    purchaseDelivery: 'BEFORE',
    purchaseExpectedBefore: '2026-11-18T10:30:12.123+08:00',
    purchaseStatus: 'RECEIVED',
  })
  expect(state.status).toBe('ACTIVE')
  expect(parseListState(listQuery(state))).toEqual(state)
  expect(editedCutoff(state, dateInput(new Date(state.expectedBefore)))).toBe('2026-11-18T02:30:12.123Z')
  expect(editedCutoff(state, '2026-11-17')).toBe(dateCutoff('2026-11-17'))
  expect(listQuery(state)).not.toHaveProperty('storeId')
  const supplier = parseListState({ supplierKeyword: ' Supplier ', supplierPage: '2', ...listQuery(state) }, true)
  expect(supplier).toMatchObject({ keyword: 'Supplier', page: 2, delivery: 'ALL', status: 'ACTIVE' })
  expect(
    listTarget({ ...listQuery(state), view: 'purchases', purchaseId: 'p', storeId: 'legacy' }, supplier, true),
  ).toMatchObject({ purchaseId: 'p', purchasePage: '3', supplierPage: '2' })
})
it('normalizes malformed list links, null dates and terminal statuses without broadening pending-material scope', () => {
  const now = new Date('2026-11-18T12:00:00Z')
  const state = parseListState(
    { purchaseKeyword: ['bad'], purchasePage: ['2'], purchaseDelivery: ['BEFORE'], purchaseStatus: 'bad' },
    false,
    false,
    now,
  )
  expect(state).toMatchObject({ keyword: '', page: 1, status: 'ACTIVE', delivery: 'ALL' })
  expect(parseListState({ purchaseDelivery: 'UNDATED', purchaseStatus: 'CANCELLED' }).status).toBe('ACTIVE')
  expect(parseListState({ purchaseStatus: 'ALL' }, false, true).status).toBe('ACTIVE')
  for (const cutoff of ['bad', '2026-02-30T00:00:00Z', ['2026-11-18T00:00:00Z']])
    expect(
      parseListState({ purchaseDelivery: 'BEFORE', purchaseExpectedBefore: cutoff }, false, false, now).expectedBefore,
    ).toBe(dateCutoff(dateInput(now)))
  for (const day of ['', '2026-02-30']) expect(() => dateCutoff(day)).toThrow('invalidDelivery')
  expect(isCanonicalList({ purchaseStatus: 'ACTIVE' }, state)).toBe(false)
  expect(isCanonicalList(listQuery(state), state)).toBe(true)
})
