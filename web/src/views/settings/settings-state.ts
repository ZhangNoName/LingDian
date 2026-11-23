import type { IntegrationProvider, IntegrationCapabilityContract } from '@lingdian/contracts'
const providers: readonly IntegrationProvider[] = ['CASHIER', 'RECEIPT_PRINTER', 'MEITUAN_WAIMAI', 'JD_DAOJIA']
import type { MerchantStoreSummary } from '@/services/integrations'
import { resolveSingleStoreView, type SingleStoreViewState } from '@/views/stores/store-view'

export type SingleStoreIntegrationState = {
  storeState: SingleStoreViewState
  capabilities: IntegrationCapabilityContract[]
}

/**
 * Loads capabilities only when the merchant scope resolves to exactly one store.
 * Empty or unexpected multi-store responses deliberately fail closed.
 */
export async function loadSingleStoreCapabilities(
  stores: readonly MerchantStoreSummary[],
  loadCapabilities: (storeId: string) => Promise<IntegrationCapabilityContract[]>,
): Promise<SingleStoreIntegrationState> {
  const storeState = resolveSingleStoreView(stores)
  if (storeState.kind !== 'ready') {
    return { storeState, capabilities: [] }
  }

  const capabilities = await loadCapabilities(storeState.store.id)
  assertCapabilitiesForStore(capabilities, storeState.store.id)
  return { storeState, capabilities }
}

export function assertCapabilitiesForStore(items: readonly IntegrationCapabilityContract[], storeId: string): void {
  const seen = new Set<string>()
  for (const item of items) {
    if (item.store_id !== storeId || !providers.includes(item.provider) || seen.has(item.provider))
      throw Error('settings.storeMismatch')
    seen.add(item.provider)
  }
}
