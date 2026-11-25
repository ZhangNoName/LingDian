import type { LocationQuery } from 'vue-router'
import type { Locale } from '@/i18n/locale'
import { activityQuery, parseActivityState } from '@/views/warehouse/activity-state'
import { inventoryNavigationContext } from '@/views/warehouse/materials/state'
import { parseTrendView, trendTarget } from '@/views/warehouse/trend/state'

type WarehouseView = 'inventory' | 'stocktakes' | 'purchases' | 'history' | 'report' | 'alerts' | 'holds' | 'recipes'
type Subview = 'suppliers' | 'report' | 'replenishment' | 'analysis' | 'trend'
interface WarehouseSection {
  view: WarehouseView
  subview?: Subview
  label: Record<Locale, string>
}

export interface WarehouseGroup {
  label: Record<Locale, string>
  sections: readonly [WarehouseSection, ...WarehouseSection[]]
}

export const warehouseGroups: readonly WarehouseGroup[] = [
  {
    label: { 'zh-CN': '库存清单', 'en-US': 'Stock list' },
    sections: [
      { view: 'inventory', label: { 'zh-CN': '原料库存', 'en-US': 'Ingredient stock' } },
      { view: 'recipes', label: { 'zh-CN': '销售配方', 'en-US': 'Sales recipes' } },
    ],
  },
  {
    label: { 'zh-CN': '预警与占用', 'en-US': 'Alerts & holds' },
    sections: [
      { view: 'alerts', label: { 'zh-CN': '预警中心', 'en-US': 'Stock alerts' } },
      { view: 'holds', label: { 'zh-CN': '原料占用', 'en-US': 'Ingredient holds' } },
    ],
  },
  {
    label: { 'zh-CN': '采购管理', 'en-US': 'Purchasing' },
    sections: [
      { view: 'purchases', label: { 'zh-CN': '采购单', 'en-US': 'Purchase orders' } },
      { view: 'purchases', subview: 'replenishment', label: { 'zh-CN': '补货建议', 'en-US': 'Replenishment' } },
      { view: 'purchases', subview: 'suppliers', label: { 'zh-CN': '供应商', 'en-US': 'Suppliers' } },
      { view: 'purchases', subview: 'report', label: { 'zh-CN': '收货报表', 'en-US': 'Receipt report' } },
    ],
  },
  {
    label: { 'zh-CN': '盘点单', 'en-US': 'Stocktakes' },
    sections: [{ view: 'stocktakes', label: { 'zh-CN': '盘点单', 'en-US': 'Stocktakes' } }],
  },
  {
    label: { 'zh-CN': '库存报表', 'en-US': 'Inventory reports' },
    sections: [
      { view: 'history', label: { 'zh-CN': '变动记录', 'en-US': 'Movement history' } },
      { view: 'report', label: { 'zh-CN': '收支报表', 'en-US': 'Stock movement report' } },
      { view: 'report', subview: 'analysis', label: { 'zh-CN': '损耗与盘点分析', 'en-US': 'Loss & count analysis' } },
      { view: 'report', subview: 'trend', label: { 'zh-CN': '按日趋势', 'en-US': 'Daily trend' } },
    ],
  },
]

export const warehouseSections = warehouseGroups.flatMap((group) => group.sections)

export function warehouseSection(query: LocationQuery = {}): WarehouseSection {
  const subview = query.view === 'purchases' ? query.purchaseView : query.view === 'report' ? query.reportView : undefined
  return warehouseSections.find((section) => section.view === query.view && section.subview === subview)
    ?? warehouseSections.find((section) => section.view === query.view)
    ?? warehouseSections[0]!
}

export function warehouseGroup(section: WarehouseSection): WarehouseGroup {
  return warehouseGroups.find((group) => group.sections.includes(section)) ?? warehouseGroups[0]!
}

export function warehouseSectionTarget(section: WarehouseSection, query: LocationQuery = {}) {
  const { view, subview } = section
  if ((view === 'report' || view === 'history') && (query.view === 'report' || query.view === 'history')) {
    const state = parseActivityState(query)
    const applied = {
      ...state,
      page: 1,
      kind: view === 'history' && query.view === 'history' ? state.kind : '' as const,
      keyword: query.reportView === 'trend' ? '' : state.keyword,
    }
    const next = subview === 'trend'
      ? trendTarget(query, applied, applied.itemId, { ...parseTrendView(query), day: '', page: 1 })
      : { view, ...inventoryNavigationContext(query), ...activityQuery(applied), ...(subview && { reportView: subview }) }
    return { name: 'warehouse', query: next }
  }

  const next: LocationQuery = { ...query, view }
  if (view === 'purchases') {
    delete next.purchaseView
    if (subview) next.purchaseView = subview
    delete next.purchaseId
    delete next.pendingItemId
    if (query.view === 'purchases') return { name: 'warehouse', query: next }
  }
  for (const key of ['page', 'itemId', 'purchaseId', 'stocktakeId', 'alertId', 'materialId', 'trendItem', 'trendStartAt', 'trendEndAt', 'trendDay', 'trendPage']) {
    delete next[key]
  }
  if (view === 'report' || next.reportView === 'trend') delete next.reportView
  if (view === 'report' && subview) next.reportView = subview
  return { name: 'warehouse', query: next }
}
