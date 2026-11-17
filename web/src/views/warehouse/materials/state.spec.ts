import { describe, expect, it } from 'vitest'
import { dateInput } from '../activity-state'
import {
  canonicalStock,
  inventoryNavigationContext,
  materialActivityTarget,
  materialRecordId,
  parseStockState,
  returnMaterialTarget,
  stockQuery,
  stockTarget,
} from './state'
describe('material workspace state', () => {
  it('restores an exact material independently of stock filters and keeps other workspaces separate', () => {
    const query = {
      view: 'inventory',
      stockKeyword: ' Flour & milk ',
      stockPage: '02',
      stockStatus: 'LOW',
      inventoryLifecycle: 'ALL',
      materialId: ' item/1 ',
      alertStatus: 'OPEN',
      page: '9',
    }
    const state = parseStockState(query)
    expect(state).toEqual({ keyword: 'Flour & milk', status: 'LOW', lifecycle: 'ALL', page: 2 })
    const target = stockTarget(query, state, materialRecordId(query.materialId))
    expect(target).toEqual({
      view: 'inventory',
      alertStatus: 'OPEN',
      page: '9',
      stockKeyword: 'Flour & milk',
      stockPage: '2',
      stockStatus: 'LOW',
      inventoryLifecycle: 'ALL',
      materialId: 'item/1',
    })
    expect(canonicalStock(target, state, 'item/1')).toBe(true)
    expect(canonicalStock(query, state, 'item/1')).toBe(false)
    expect(stockTarget(target, state)).not.toHaveProperty('materialId')
  })
  it('drops invalid and repeated values and does not use availability status for archived materials', () => {
    expect(
      parseStockState({
        stockKeyword: ['milk'],
        stockPage: ['2'],
        stockStatus: ['OUT'],
        inventoryLifecycle: ['ALL'],
      }),
    ).toEqual({ keyword: '', status: '', lifecycle: 'ACTIVE', page: 1 })
    for (const stockPage of ['0', '-1', '1.1', '1000001', '1e3'])
      expect(parseStockState({ stockPage }).page).toBe(1)
    expect(parseStockState({ stockKeyword: 'x'.repeat(121) }).keyword).toHaveLength(120)
    expect(stockQuery(parseStockState({ inventoryLifecycle: 'ARCHIVED', stockStatus: 'OUT' }))).toEqual({
      inventoryLifecycle: 'ARCHIVED',
    })
    for (const id of [null, ['id'], 'x'.repeat(192), 'a\nb', '\x7f']) expect(materialRecordId(id)).toBe('')
    expect(materialRecordId(' id? /& ')).toBe('id? /&')
  })
  it('returns from history and reports to the same material and stock list without carrying tenant ids', () => {
    const query = {
      stockKeyword: 'Flour',
      stockPage: '3',
      stockStatus: 'OUT',
      inventoryLifecycle: 'ALL',
      materialId: 'item-a',
      storeId: 'foreign',
      tenantId: 'foreign',
      alertId: 'alert-b',
    }
    const context = inventoryNavigationContext(query)
    expect(context).toEqual({
      stockKeyword: 'Flour',
      stockPage: '3',
      stockStatus: 'OUT',
      inventoryLifecycle: 'ALL',
      materialId: 'item-a',
    })
    for (const mode of ['history', 'report'] as const) {
      const target = materialActivityTarget(query, 'item-b', mode, new Date(2026, 10, 18, 12))
      expect(target).toMatchObject({
        view: mode,
        itemId: 'item-b',
        materialId: 'item-b',
        stockPage: '3',
        stockKeyword: 'Flour',
      })
      expect(dateInput(new Date(target.startAt!))).toBe('2026-10-20')
      expect(dateInput(new Date(target.endAt!))).toBe('2026-11-19')
      expect(target).not.toHaveProperty('kind')
      expect(returnMaterialTarget(target)).toEqual({ ...context, view: 'inventory', materialId: 'item-b' })
    }
  })
  it('recognizes equivalent link encodings and keeps default links compact', () => {
    const query = Object.fromEntries(
      new URLSearchParams('stockKeyword=Flour%20%26%20milk&materialId=item%2F1'),
    )
    expect(canonicalStock(query, parseStockState(query), materialRecordId(query.materialId))).toBe(true)
    expect(stockQuery(parseStockState({}))).toEqual({})
  })
})
