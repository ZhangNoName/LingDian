import type { ProductRecordContract } from '@lingdian/contracts'
import { apiUrl } from '@/config/api'
import { requestData } from '@/lib/api'
const base = (store: string, id: string) =>
  `/merchant/stores/${encodeURIComponent(store)}/products/${encodeURIComponent(id)}/image`
export function uploadMerchantImage(
  store: string,
  id: string,
  file: File,
  requestId: string,
  version: number,
): Promise<ProductRecordContract> {
  const body = new FormData()
  body.append('requestId', requestId)
  body.append('expected_version', String(version))
  body.append('file', file)
  return requestData(apiUrl(base(store, id)), { method: 'POST', body })
}
export function removeMerchantImage(
  store: string,
  id: string,
  requestId: string,
  version: number,
): Promise<ProductRecordContract> {
  return requestData(apiUrl(base(store, id) + '/remove'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requestId, expected_version: version }),
  })
}
export function productImageSource(value: string | null | undefined, apiBase: string, pageUrl: string): string {
  if (!value) return ''
  try {
    if (value.startsWith('/uploads/')) return new URL(value, new URL(apiBase, pageUrl).origin).href
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) ? url.href : ''
  } catch {
    return ''
  }
}
