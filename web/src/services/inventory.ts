import type { AdjustInventoryRequest, CreateInventoryItemRequest, InventoryItemContract, InventoryMovementContract, InventoryMovementPage, InventoryPage, InventoryStatus } from '@lingdian/contracts'
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
export function listInventoryMovements(storeId: string, page: number, itemId?: string): Promise<InventoryMovementPage> {
  const params = new URLSearchParams({ page: String(page), pageSize: '20' })
  if (itemId) params.set('itemId', itemId)
  return requestData(apiUrl(`${base(storeId)}/movements?${params}`))
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
