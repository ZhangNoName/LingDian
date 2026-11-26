import { readonly, ref } from 'vue'

const reuseForMs = 60_000
const maxEntries = 64

interface Entry {
  result: Promise<unknown>
  expiresAt: number
}

const entries = new Map<string, Entry>()
const revision = ref(0)
export const merchantDataRevision = readonly(revision)

export function clearMerchantViewData() {
  entries.clear()
}

export function invalidateMerchantViewData() {
  clearMerchantViewData()
  revision.value++
}

export function hasMerchantViewData(parts: readonly unknown[]): boolean {
  const expiresAt = entries.get(JSON.stringify(parts))?.expiresAt ?? 0
  return Number.isFinite(expiresAt) && expiresAt > Date.now()
}

export function readMerchantViewData<T>(parts: readonly unknown[], fetchData: () => Promise<T>, refresh: boolean): Promise<T> {
  const key = JSON.stringify(parts)
  const previous = entries.get(key)
  entries.delete(key)
  if (!refresh && previous && previous.expiresAt > Date.now()) {
    entries.set(key, previous)
    return previous.result as Promise<T>
  }

  const result = (async () => fetchData())()
  const entry = { result, expiresAt: Infinity }
  entries.set(key, entry)
  if (entries.size > maxEntries) entries.delete(entries.keys().next().value!)
  void result.then(
    () => { entry.expiresAt = Date.now() + reuseForMs },
    () => { if (entries.get(key) === entry) entries.delete(key) },
  )
  return result
}
