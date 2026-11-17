import { describe, expect, it } from 'vitest'
import { alertId, alertQuery, alertTarget, canonicalAlerts, parseAlertState } from './state'
describe('alert workspace links', () => {
  it('restores an exact record independently of filtered list and retains unrelated workspace fields', () => {
    const query = {
      view: 'alerts',
      alertStatus: 'RESOLVED',
      alertSeverity: 'OUT',
      alertKeyword: ' Flour & milk ',
      alertPage: '03',
      alertId: ' alert/1 ',
      purchaseStatus: 'PARTIAL',
    }
    const state = parseAlertState(query)
    expect(state).toEqual({ status: 'RESOLVED', severity: 'OUT', keyword: 'Flour & milk', page: 3 })
    const target = alertTarget(query, state, alertId(query.alertId))
    expect(target).toEqual({
      view: 'alerts',
      purchaseStatus: 'PARTIAL',
      alertStatus: 'RESOLVED',
      alertSeverity: 'OUT',
      alertKeyword: 'Flour & milk',
      alertPage: '3',
      alertId: 'alert/1',
    })
    expect(canonicalAlerts(target, state, 'alert/1')).toBe(true)
    expect(canonicalAlerts(query, state, 'alert/1')).toBe(false)
    expect(alertTarget(target, state)).not.toHaveProperty('alertId')
    expect(alertTarget(target, state)).toHaveProperty('alertPage', '3')
  })
  it('rejects repeated values, malformed pages, unbounded input and control characters in record ids', () => {
    for (const page of [undefined, ['2'], '0', '1.5', '1e3', '1000001', '-1'])
      expect(parseAlertState({ alertPage: page }).page).toBe(1)
    expect(
      parseAlertState({ alertStatus: ['OPEN'], alertSeverity: ['LOW'], alertKeyword: ['milk'] }),
    ).toEqual({ status: 'ACTIVE', severity: '', keyword: '', page: 1 })
    expect(
      parseAlertState({ alertStatus: 'DELETED', alertSeverity: 'URGENT', alertKeyword: 'x'.repeat(121) })
        .keyword,
    ).toHaveLength(120)
    for (const id of [null, ['id'], 'x'.repeat(192), 'a\nb', '\x7f']) expect(alertId(id)).toBe('')
    expect(alertId(' alert ?&/ ')).toBe('alert ?&/')
    expect(alertQuery(parseAlertState({}))).toEqual({})
  })
  it('normalizes equivalent URL encodings without losing a valid list or exact record', () => {
    const query = Object.fromEntries(
      new URLSearchParams('view=alerts&alertStatus=ALL&alertKeyword=Flour%20%26%20milk&alertId=alert%2F1'),
    )
    expect(canonicalAlerts(query, parseAlertState(query), alertId(query.alertId))).toBe(true)
    expect(alertTarget(query, parseAlertState({}))).toEqual({ view: 'alerts' })
  })
})
