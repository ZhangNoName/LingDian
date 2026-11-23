import { inject, onScopeDispose, watch, type InjectionKey, type Ref, type WatchSource } from 'vue'

export const warehouseViewLockKey: InjectionKey<Ref<boolean>> = Symbol('warehouse-view-lock')

export function useWarehouseViewLock(source: WatchSource<boolean>) {
  const lock = inject(warehouseViewLockKey)
  if (!lock) return
  watch(source, (value) => { lock.value = value }, { immediate: true })
  onScopeDispose(() => { lock.value = false })
}
