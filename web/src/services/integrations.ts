import type {
  IntegrationCapabilityContract,
  IntegrationProvider,
  SetIntegrationEnabledRequest,
} from '@lingdian/contracts'
import { apiUrl } from '@/config/api'
import { requestData } from '@/lib/api'

export type MerchantStoreSummary = {
  id: string
  code: string
  name: string
  status: 'OPEN' | 'CLOSED' | 'RESTING'
}

export function listMerchantStores(): Promise<MerchantStoreSummary[]> {
  return requestData(apiUrl('/merchant/stores'))
}

export function listStoreIntegrations(storeId: string): Promise<IntegrationCapabilityContract[]> {
  return requestData(apiUrl(`/merchant/stores/${encodeURIComponent(storeId)}/integrations`))
}

export function setStoreIntegrationEnabled(
  storeId: string,
  provider: IntegrationProvider,
  enabled: boolean,
): Promise<IntegrationCapabilityContract> {
  const body: SetIntegrationEnabledRequest = { enabled }
  return requestData(apiUrl(
    `/merchant/stores/${encodeURIComponent(storeId)}/integrations/${encodeURIComponent(provider)}`,
  ), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}
