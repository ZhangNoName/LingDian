<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { listInventoryAlerts } from '@/services/inventory'
import { useLocale } from '@/i18n/locale'
const props = defineProps<{ storeId: string }>()
const { locale } = useLocale(), route = useRoute()
const open = ref<number>(), failed = ref(false)
let sequence = 0, timer: ReturnType<typeof setInterval> | undefined
async function load() {
  if (document.hidden) return
  const current = ++sequence
  try { const data = await listInventoryAlerts(props.storeId, { page: 1, status: 'OPEN' }); if (current === sequence) { open.value = data.summary.open; failed.value = false } }
  catch { if (current === sequence) { failed.value = true; open.value = undefined } }
}
function changed(event: Event) {
  const detail = (event as CustomEvent<{ storeId?: string; open?: number }>).detail
  if (detail?.storeId === props.storeId && typeof detail.open === 'number' && Number.isSafeInteger(detail.open) && detail.open >= 0) {
    sequence++; open.value = detail.open; failed.value = false
  } else { void load() }
}
function visible() { if (!document.hidden) void load() }
watch(() => route.fullPath, load)
onMounted(() => { void load(); timer = setInterval(load, 60000); document.addEventListener('visibilitychange', visible); window.addEventListener('inventory-alerts-changed', changed) })
onBeforeUnmount(() => { sequence++; if (timer) clearInterval(timer); document.removeEventListener('visibilitychange', visible); window.removeEventListener('inventory-alerts-changed', changed) })
</script>
<template>
  <RouterLink :to="{ name: 'warehouse', query: { view: 'alerts' } }" class="inline-flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-muted" :title="locale === 'en-US' ? 'Checked every minute while visible' : '页面可见时每分钟更新'">
    <span>{{ locale === 'en-US' ? 'Stock alerts' : '库存预警' }}</span><span v-if="failed" class="text-xs text-muted-foreground">{{ locale === 'en-US' ? 'Unavailable' : '暂不可用' }}</span><span v-else-if="open !== undefined" class="rounded bg-muted px-1.5 text-xs tabular-nums" :class="{ 'font-semibold text-amber-800': open > 0 }">{{ open }}</span>
  </RouterLink>
</template>
