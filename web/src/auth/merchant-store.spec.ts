import { describe, expect, it } from 'vitest'
import { createMerchantStoreContext } from './merchant-store'
const a = { id: 'a', code: 'A', name: 'Store A', status: 'OPEN' as const }
const b = { id: 'b', code: 'B', name: 'Store B', status: 'OPEN' as const }

describe('merchant store selection', () => {
  it('requires an explicit choice for multiple stores and rejects foreign ids', () => {
    const state = createMerchantStoreContext()
    state.updateSession('merchant', ['a', 'b'])
    state.setStores([a, b, { ...a, id: 'foreign' }])
    expect(state.stores.value.map((store) => store.id)).toEqual(['a', 'b'])
    expect(state.selectedId.value).toBe('')
    expect(() => state.select('foreign')).toThrow('not authorized')
    state.select('b')
    expect(state.selectedId.value).toBe('b')
  })
  it('automatically selects the only authorized store', () => {
    const state = createMerchantStoreContext()
    state.updateSession('merchant', ['b'])
    state.setStores([b])
    expect(state.selectedId.value).toBe('b')
  })
  it('does not retain another account selection or a revoked store', () => {
    const state = createMerchantStoreContext()
    state.updateSession('first', ['a', 'b']); state.setStores([a, b]); state.select('b')
    state.updateSession('second', ['a', 'b'])
    expect(state.selectedId.value).toBe('')
    state.setStores([a, b]); state.select('b'); state.updateSession('second', ['a'])
    expect(state.selectedId.value).toBe('a')
    state.clear(); expect(state.selectedId.value).toBe(''); expect(state.stores.value).toEqual([])
  })
  it('restores only an authorized selection and works when storage is unavailable', () => {
    const saved = new Map([['lingdian.store.merchant', 'b']])
    const storage = { getItem: (key: string) => saved.get(key) ?? null, setItem: (key: string, value: string) => { saved.set(key, value) }, removeItem: (key: string) => { saved.delete(key) } }
    const state = createMerchantStoreContext(storage)
    state.updateSession('merchant', ['a', 'b']); state.setStores([a, b])
    expect(state.selectedId.value).toBe('b')
    const noStorage = createMerchantStoreContext({ getItem: () => { throw new Error() }, setItem: () => { throw new Error() }, removeItem: () => { throw new Error() } })
    noStorage.updateSession('merchant', ['a']); noStorage.setStores([a]); noStorage.select('a'); noStorage.clear()
    expect(noStorage.selectedId.value).toBe('')
  })
})
