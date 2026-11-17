import { apiUrl } from '@/config/api'
import { requestData } from '@/lib/api'
import type {
  CreateStocktake,
  SaveStocktake,
  StocktakePage,
  StocktakeRecord,
  StocktakeStatus,
} from '@lingdian/contracts'
const base = (store: string) => `/merchant/stores/${encodeURIComponent(store)}/inventory/stocktakes`
function write(store: string, suffix: string, body: unknown, method = 'POST'): Promise<StocktakeRecord> {
  return requestData(apiUrl(base(store) + suffix), {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}
export function listStocktakes(
  store: string,
  page = 1,
  keyword = '',
  status: StocktakeStatus | 'ALL' = 'ALL',
): Promise<StocktakePage> {
  return requestData(
    apiUrl(`${base(store)}?${new URLSearchParams({ page: String(page), pageSize: '20', keyword, status })}`),
  )
}
export function getStocktake(store: string, id: string): Promise<StocktakeRecord> {
  return requestData(apiUrl(`${base(store)}/${encodeURIComponent(id)}`))
}
export function createStocktake(store: string, body: CreateStocktake) {
  return write(store, '', body)
}
export function saveStocktake(store: string, id: string, body: SaveStocktake) {
  return write(store, `/${encodeURIComponent(id)}/counts`, body, 'PUT')
}
export function stocktakeAction(
  store: string,
  id: string,
  action: 'post' | 'cancel' | 'recount',
  expectedVersion: number,
) {
  return write(store, `/${encodeURIComponent(id)}/${action}`, { expectedVersion })
}
