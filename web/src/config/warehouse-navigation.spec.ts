import { expect, it } from 'vitest'
import { warehouseSection, warehouseSectionTarget, warehouseSections } from './warehouse-navigation'

it('resolves old warehouse routes and each report and purchasing subsection', () => {
  for (const section of warehouseSections) {
    const scope = section.view === 'purchases' ? { purchaseView: section.subview } : { reportView: section.subview }
    const query = { view: section.view, ...Object.fromEntries(Object.entries(scope).filter(([, value]) => value !== undefined)) }
    expect(warehouseSection(query)).toBe(section)
  }
  expect(warehouseSection().view).toBe('inventory')
  expect(warehouseSection({ view: ['report'] }).view).toBe('inventory')
  expect(warehouseSection({ view: 'purchases', purchaseView: 'unknown' }).subview).toBeUndefined()
})

it('keeps the applied dates when changing the report view and clears the trend selection', () => {
  const query = {
    view: 'report', reportView: 'trend', startAt: '2026-10-20T00:00:00.000Z', endAt: '2026-11-19T00:00:00.000Z',
    stockStatus: 'LOW', page: '2', materialId: 'material-a', itemId: 'item-a', trendDay: '2026-11-01', trendPage: '3',
  }
  const section = warehouseSection({ view: 'report', reportView: 'analysis' })
  expect(warehouseSectionTarget(section, query)).toEqual({
    name: 'warehouse',
    query: { view: 'report', reportView: 'analysis', startAt: query.startAt, endAt: query.endAt, stockStatus: 'LOW', materialId: 'material-a', itemId: 'item-a' },
  })
  const stock = warehouseSectionTarget(warehouseSection(), query).query
  expect(stock).toEqual({ view: 'inventory', startAt: query.startAt, endAt: query.endAt, stockStatus: 'LOW' })
  expect(query.materialId).toBe('material-a')
})

it('keeps purchasing filters while closing a pending-material or detail view when switching menus', () => {
  const query = { view: 'purchases', purchaseView: 'report', purchaseId: 'order-1', pendingItemId: 'item-a', purchaseStatus: 'OPEN', supplierKeyword: 'food' }
  const orders = warehouseSectionTarget(warehouseSection({ view: 'purchases' }), query)
  expect(orders.query).toEqual({ view: 'purchases', purchaseStatus: 'OPEN', supplierKeyword: 'food' })
  const suppliers = warehouseSection({ view: 'purchases', purchaseView: 'suppliers' })
  expect(warehouseSectionTarget(suppliers, query).query).toEqual({ ...orders.query, purchaseView: 'suppliers' })
})
