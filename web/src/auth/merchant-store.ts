import { readonly, ref } from 'vue'

export interface AuthorizedStore { id: string; code: string; name: string; status: 'OPEN' | 'CLOSED' | 'RESTING' }

/** A store selection belongs to one signed-in account and one browser tab. */
export function createMerchantStoreContext(storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>) {
  const selectedId = ref('')
  const stores = ref<AuthorizedStore[]>([])
  let owner = ''
  let allowedIds: string[] = []
  const key = () => `lingdian.store.${owner}`
  function updateSession(userId: string, ids: readonly string[]) {
    const changedOwner = owner !== userId
    owner = userId
    allowedIds = [...new Set(ids)]
    if (changedOwner) { selectedId.value = ''; stores.value = [] }
    stores.value = stores.value.filter((store) => allowedIds.includes(store.id))
    let saved = ''
    try { saved = storage?.getItem(key()) ?? '' } catch { /* Browser storage may be disabled. */ }
    const preferred = selectedId.value || saved
    selectedId.value = allowedIds.includes(preferred) ? preferred : allowedIds.length === 1 ? allowedIds[0]! : ''
  }
  function setStores(value: readonly AuthorizedStore[]) {
    stores.value = value.filter((store) => allowedIds.includes(store.id))
    if (!stores.value.some((store) => store.id === selectedId.value)) selectedId.value = ''
    if (stores.value.length === 1) select(stores.value[0]!.id)
  }
  function select(id: string) {
    if (!allowedIds.includes(id) || !stores.value.some((store) => store.id === id)) throw new Error('Store is not authorized')
    selectedId.value = id
    try { storage?.setItem(key(), id) } catch { /* Selection still works without storage. */ }
  }
  function clear() {
    try { if (owner) storage?.removeItem(key()) } catch { /* Browser storage may be disabled. */ }
    owner = ''; allowedIds = []; selectedId.value = ''; stores.value = []
  }
  return { selectedId: readonly(selectedId), stores: readonly(stores), updateSession, setStores, select, clear }
}
let storage: Storage | undefined
try { storage = globalThis.sessionStorage } catch { /* Storage is optional. */ }
export const merchantStore = createMerchantStoreContext(storage)
