import type { ProductStatus } from '@lingdian/contracts'
import type { CatalogKey } from './catalog-management-locale'
export function catalogStatusActions(status: unknown): Array<{ status: ProductStatus; label: CatalogKey }> {
  if (status === 'ARCHIVED') return [{ status: 'DRAFT', label: 'restore' }]
  if (!['DRAFT', 'ACTIVE', 'SOLD_OUT'].includes(String(status))) return []
  return [
    { status: status === 'ACTIVE' ? 'SOLD_OUT' : 'ACTIVE', label: status === 'ACTIVE' ? 'soldOut' : 'publish' },
    ...(status !== 'DRAFT' ? [{ status: 'DRAFT' as const, label: 'unpublish' as const }] : []),
    { status: 'ARCHIVED', label: 'archive' },
  ]
}
