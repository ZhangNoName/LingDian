import { requestData } from '@/lib/api'
import { apiUrl } from '@/config/api'
import type {
  CreatePurchaseRequest,
  ReceivePurchaseRequest,
  SupplierInput,
  SupplierRecord,
  PurchaseRecord,
  PurchaseReceiptRecord,
  PurchasingPage,
} from '@lingdian/contracts'
const base = (store: string) => `/merchant/stores/${encodeURIComponent(store)}/inventory`
function write<T>(url: string, body: unknown, method = 'POST'): Promise<T> {
  return requestData(apiUrl(url), {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}
export function supplierList(
  store: string,
  page = 1,
  keyword = '',
  active = false,
): Promise<PurchasingPage<SupplierRecord>> {
  return requestData(
    apiUrl(
      `${base(store)}/suppliers?${new URLSearchParams({ page: String(page), pageSize: '20', keyword, status: active ? 'ACTIVE' : 'ALL' })}`,
    ),
  )
}
export function saveSupplier(
  store: string,
  body: SupplierInput,
  id?: string,
  expectedVersion?: number,
): Promise<SupplierRecord> {
  return write(
    `${base(store)}/suppliers${id ? '/' + encodeURIComponent(id) : ''}`,
    { ...body, ...(id ? { expectedVersion } : {}) },
    id ? 'PUT' : 'POST',
  )
}
export function purchaseList(
  store: string,
  page = 1,
  keyword = '',
  status = 'ACTIVE',
): Promise<PurchasingPage<PurchaseRecord>> {
  return requestData(
    apiUrl(`${base(store)}/purchases?${new URLSearchParams({ page: String(page), pageSize: '20', keyword, status })}`),
  )
}
export function purchaseDetail(store: string, id: string): Promise<PurchaseRecord> {
  return requestData(apiUrl(`${base(store)}/purchases/${encodeURIComponent(id)}`))
}
export function purchaseReceipts(store: string, id: string, page = 1): Promise<PurchasingPage<PurchaseReceiptRecord>> {
  return requestData(apiUrl(`${base(store)}/purchases/${encodeURIComponent(id)}/receipts?page=${page}&pageSize=10`))
}
export function createPurchase(store: string, body: CreatePurchaseRequest): Promise<PurchaseRecord> {
  return write(`${base(store)}/purchases`, body)
}
export function receivePurchase(
  store: string,
  id: string,
  body: ReceivePurchaseRequest,
): Promise<PurchaseReceiptRecord> {
  return write(`${base(store)}/purchases/${encodeURIComponent(id)}/receipts`, body)
}
export function cancelPurchase(
  store: string,
  id: string,
  body: { expectedVersion: number; note: string },
): Promise<PurchaseRecord> {
  return write(`${base(store)}/purchases/${encodeURIComponent(id)}/cancel`, body)
}

export function purchaseReport(
  store: string,
  filter: import('@lingdian/contracts').PurchaseReportFilter,
): Promise<import('@lingdian/contracts').PurchaseReceiptReport> {
  const params = new URLSearchParams({ startAt: filter.startAt, endAt: filter.endAt })
  for (const key of ['keyword', 'itemId', 'supplierId'] as const) if (filter[key]) params.set(key, filter[key])
  return requestData(apiUrl(`${base(store)}/purchases/report?${params}`))
}
export function replenishmentSnapshot(
  store: string,
  filter: { keyword?: string; itemId?: string } = {},
): Promise<import('@lingdian/contracts').ReplenishmentSnapshot> {
  const params = new URLSearchParams()
  if (filter.keyword) params.set('keyword', filter.keyword)
  if (filter.itemId) params.set('itemId', filter.itemId)
  return requestData(apiUrl(`${base(store)}/purchases/replenishment?${params}`))
}
