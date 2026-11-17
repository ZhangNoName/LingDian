import type { AdjustInventoryRequest, CreateInventoryItemRequest, InventoryItemContract, InventoryMovementContract, InventoryMovementPage, InventoryPage, InventoryStatus, InventoryActivityFilter, InventoryPeriodReport, InventoryReportFilter } from '@lingdian/contracts'
import { apiUrl } from '@/config/api'
import { requestData } from '@/lib/api'

export interface InventoryQuery { page: number; pageSize: number; keyword?: string; status?: InventoryStatus }
function base(storeId: string) { return `/merchant/stores/${encodeURIComponent(storeId)}/inventory` }
export function listInventory(storeId: string, query: InventoryQuery): Promise<InventoryPage> {
  const params = new URLSearchParams({ page: String(query.page), pageSize: String(query.pageSize) })
  if (query.keyword?.trim()) params.set('keyword', query.keyword.trim())
  if (query.status) params.set('status', query.status)
  return requestData(apiUrl(`${base(storeId)}?${params}`))
}
export function listInventoryMovements(storeId: string, page: number, filter: InventoryActivityFilter = {}): Promise<InventoryMovementPage> {
  const params = new URLSearchParams({ page: String(page), pageSize: '20' })
  appendFilter(params, filter)
  return requestData(apiUrl(`${base(storeId)}/movements?${params}`))
}
export function getInventoryReport(storeId: string, filter: InventoryReportFilter): Promise<InventoryPeriodReport> {
  const params = new URLSearchParams()
  appendFilter(params, filter)
  return requestData(apiUrl(`${base(storeId)}/report?${params}`))
}
function appendFilter(params: URLSearchParams, filter: InventoryActivityFilter) {
  for (const key of ['startAt', 'endAt', 'itemId', 'keyword', 'kind'] as const) if (filter[key]) params.set(key, filter[key])
}
export function createInventoryItem(storeId: string, body: CreateInventoryItemRequest): Promise<InventoryItemContract> {
  return requestData(apiUrl(base(storeId)), jsonPost(body))
}
export function adjustInventory(storeId: string, itemId: string, body: AdjustInventoryRequest): Promise<InventoryMovementContract> {
  return requestData(apiUrl(`${base(storeId)}/${encodeURIComponent(itemId)}/movements`), jsonPost(body))
}
function jsonPost(body: unknown): RequestInit {
  return { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
}

export function listInventoryRecipes(storeId: string, page: number, keyword = ''): Promise<import('@lingdian/contracts').InventoryRecipePage> {
  const params = new URLSearchParams({ page: String(page), pageSize: '20', keyword })
  return requestData(apiUrl(`${base(storeId)}/recipes?${params}`))
}
export function saveInventoryRecipe(storeId: string, skuId: string, body: import('@lingdian/contracts').SaveInventoryRecipeRequest): Promise<import('@lingdian/contracts').InventoryRecipeRecord> {
  return requestData(apiUrl(`${base(storeId)}/recipes/${encodeURIComponent(skuId)}`), { ...jsonPost(body), method: 'PUT' })
}
