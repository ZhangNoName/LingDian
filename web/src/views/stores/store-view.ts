import type { MerchantStoreSummary } from '@/services/integrations'

export type SingleStoreViewState =
  | { kind: 'ready'; store: MerchantStoreSummary }
  | { kind: 'empty' }
  | { kind: 'conflict'; storeCount: number }

export type StoreStatusPresentation = {
  label: string
  className: string
}

const statusPresentations: Record<MerchantStoreSummary['status'], StoreStatusPresentation> = {
  OPEN: {
    label: '营业中',
    className: 'border-emerald-300 bg-emerald-50 text-emerald-700',
  },
  CLOSED: {
    label: '已关闭',
    className: 'border-slate-300 bg-slate-50 text-slate-600',
  },
  RESTING: {
    label: '暂停营业',
    className: 'border-amber-300 bg-amber-50 text-amber-700',
  },
}

export function resolveSingleStoreView(stores: readonly MerchantStoreSummary[]): SingleStoreViewState {
  if (stores.length === 0) return { kind: 'empty' }
  if (stores.length === 1) return { kind: 'ready', store: stores[0] }
  return { kind: 'conflict', storeCount: stores.length }
}

export function getStoreStatusPresentation(status: MerchantStoreSummary['status']): StoreStatusPresentation {
  return statusPresentations[status]
}
