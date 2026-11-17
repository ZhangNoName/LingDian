import { describe, it, expect } from 'vitest'
import { dateInput, orderListFingerprint, orderPeriodForDraft, orderPeriodFromDates, orderStateQuery, parseOrderState } from './filter-state'
describe('order filter links', () => {
  it('round-trips filters, paging and a detail id with explicit boundaries', () => {
    const state = parseOrderState({ keyword: ' LD & 1 ', status: 'PAID', orderType: 'PICKUP', paymentChannel: 'CASH', startAt: '2026-11-01T00:00:00+08:00', endAt: '2026-11-02T00:00:00+08:00', page: '2', pageSize: '50', orderId: 'order/1' })
    expect(state.startAt).toBe('2026-10-31T16:00:00.000Z')
    expect(parseOrderState(orderStateQuery(state))).toEqual(state)
    expect(orderListFingerprint({ ...state, orderId: '' })).toBe(orderListFingerprint(state))
  })
  it('repairs unknown values without granting any store identity', () => {
    const state = parseOrderState({ status: 'ADMIN', paymentChannel: 'FORCE', page: '-1', pageSize: '20000', storeId: 'foreign', orderId: ['bad'], startAt: 'invalid', endAt: '2026-11-02T00:00:00Z' })
    expect(orderStateQuery(state)).toEqual({})
    expect(state.page).toBe(1); expect(state.pageSize).toBe(20)
  })
  it('permits all dates but rejects partial, reversed and invalid natural days', () => {
    expect(orderPeriodFromDates('', '')).toEqual({ startAt: '', endAt: '' })
    for (const [from, to] of [['2026-02-30','2026-03-01'],['','2026-11-01'],['2026-11-02','2026-11-01']]) expect(() => orderPeriodFromDates(from!, to!)).toThrow()
  })
})

it('retains exact shared instants when changing a non-date filter in another local-day context', () => {
  const period = { startAt: '2026-11-17T10:45:00.000Z', endAt: '2026-11-17T11:45:00.000Z' }
  const from = dateInput(new Date(period.startAt)), to = dateInput(new Date(Date.parse(period.endAt)-1))
  expect(orderPeriodForDraft(period, from, to)).toEqual(period)
  expect(orderPeriodForDraft(period, '', '')).toEqual({ startAt: '', endAt: '' })
})
