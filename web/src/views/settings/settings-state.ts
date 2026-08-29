import type { IntegrationCapabilityContract } from '@lingdian/contracts'
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

  return {
    storeState,
    capabilities: await loadCapabilities(storeState.store.id),
  }
}
