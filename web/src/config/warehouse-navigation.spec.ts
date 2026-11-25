import { expect, it } from 'vitest'
import { warehouseGroup, warehouseGroups, warehouseSection, warehouseSectionTarget, warehouseSections } from './warehouse-navigation'

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

it('maps warehouse links to five sidebar groups with their default pages first', () => {
  expect(warehouseGroups.map((group) => group.label['zh-CN'])).toEqual([
    '库存清单', '预警与占用', '采购管理', '盘点单', '库存报表',
  ])
  expect(warehouseGroups.map((group) => warehouseSectionTarget(group.sections[0]).query)).toEqual([
    { view: 'inventory' }, { view: 'alerts' }, { view: 'purchases' }, { view: 'stocktakes' }, { view: 'history' },
  ])
  expect(warehouseGroup(warehouseSection({ view: 'recipes' }))).toBe(warehouseGroups[0])
  expect(warehouseGroup(warehouseSection({ view: 'holds' }))).toBe(warehouseGroups[1])
  expect(warehouseGroup(warehouseSection({ view: 'purchases', purchaseView: 'suppliers' }))).toBe(warehouseGroups[2])
  expect(warehouseGroup(warehouseSection({ view: 'stocktakes', stocktakeId: 'draft-1' }))).toBe(warehouseGroups[3])
  expect(warehouseGroup(warehouseSection({ view: 'report', reportView: 'trend' }))).toBe(warehouseGroups[4])
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

it('carries the filtered material and date range from movement history into the reports', () => {
  const query = {
    view: 'history', itemId: 'item-a', materialId: 'item-a', stockStatus: 'LOW',
    startAt: '2026-10-20T00:00:00.000Z', endAt: '2026-11-19T00:00:00.000Z',
    keyword: 'flour', kind: 'ISSUE', page: '3',
  }
  const report = warehouseSection({ view: 'report' })
  const reportTarget = warehouseSectionTarget(report, query).query
  expect(reportTarget).toEqual({
    view: 'report', itemId: 'item-a', materialId: 'item-a', stockStatus: 'LOW',
    startAt: query.startAt, endAt: query.endAt, keyword: 'flour',
  })
  const history = warehouseSection({ view: 'history' })
  expect(warehouseSectionTarget(history, reportTarget).query).toEqual({ ...reportTarget, view: 'history' })
})
