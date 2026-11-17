<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { InventoryItemContract, InventoryPage, InventoryStatus } from '@lingdian/contracts'
import { useRoute, useRouter } from 'vue-router'
import { Button } from '@/baseComponents/button'
import { useLocale } from '@/i18n/locale'
import { merchantStore } from '@/auth/merchant-store'
import { listInventory } from '@/services/inventory'
import InventoryHolds from './InventoryHolds.vue'
import InventoryAlerts from './InventoryAlerts.vue'
import InventoryEditor from './InventoryEditor.vue'
import InventoryActivity from './InventoryActivity.vue'
import InventoryRecipes from './InventoryRecipes.vue'
import { en, zh, type MessageKey } from './messages'
import { downloadCsv } from './report'

const { locale } = useLocale()
const t = (key: MessageKey) => (locale.value === 'en-US' ? en : zh)[key]
const storeId = merchantStore.selectedId
const storeName = computed(() => merchantStore.stores.value.find((store) => store.id === storeId.value)?.name ?? '')
const route = useRoute(), router = useRouter()
const view = computed(() => route.query.view === 'holds' ? 'holds' : route.query.view === 'alerts' ? 'alerts' : route.query.view === 'recipes' ? 'recipes' : route.query.view === 'report' ? 'report' : route.query.view === 'history' ? 'history' : 'inventory')
const page = ref(1)
const keyword = ref('')
const appliedKeyword = ref('')
const status = ref<InventoryStatus | ''>('')
const inventory = ref<InventoryPage>()
const loading = ref(true)
const errorKey = ref<MessageKey | ''>('')
const notice = ref(false)
const editorOpen = ref(false)
const selectedItem = ref<InventoryItemContract>()
let sequence = 0
const total = computed(() => inventory.value?.total ?? 0)
const pageCount = computed(() => Math.max(1, Math.ceil(total.value / 20)))
const hasRows = computed(() => !!inventory.value?.items.length)
const statusKey: Record<InventoryStatus, MessageKey> = { HEALTHY: 'healthy', LOW: 'low', OUT: 'out' }
const format = (value: number) => value.toLocaleString(locale.value, { maximumFractionDigits: 3 })
const date = (value: string) => new Intl.DateTimeFormat(locale.value, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))

async function load() {
  const current = ++sequence
  loading.value = true
  errorKey.value = ''
  try {
    if (!storeId.value) { errorKey.value = 'noStore'; return }
    const id = storeId.value
    const result = await listInventory(id, { page: page.value, pageSize: 20, keyword: appliedKeyword.value, status: status.value || undefined })
    if (current === sequence) inventory.value = result
  } catch { if (current === sequence) errorKey.value = 'loadFailed' }
  finally { if (current === sequence) loading.value = false }
}
function switchView(value: 'inventory' | 'history' | 'report' | 'recipes' | 'alerts' | 'holds') { void router.push({ query: { ...route.query, view: value, page: undefined, itemId: undefined } }) }
function stockFromAlert(code: string) { keyword.value = code; appliedKeyword.value = code; status.value = ''; page.value = 1; switchView('inventory') }
function filter(value: InventoryStatus | '') { status.value = value; page.value = 1; void load() }
function search() { appliedKeyword.value = keyword.value.trim(); page.value = 1; void load() }
function clear() { keyword.value = ''; appliedKeyword.value = ''; status.value = ''; page.value = 1; void load() }
function go(value: number) { page.value = value; void load() }
function edit(item?: InventoryItemContract) { selectedItem.value = item; editorOpen.value = true; notice.value = false }
function showHistory(item?: InventoryItemContract) { void router.push({ query: { ...route.query, view: 'history', itemId: item?.id, page: undefined } }) }
function saved() { notice.value = true; void load() }
function exportPage() {
  const rows: (string | number)[][] = [
    [t('store'), storeName.value, storeId.value],
    [t('currentPage'), page.value, t('total'), total.value],
    [t('time'), new Date().toISOString()],
  ]
  rows.push([t('search'), appliedKeyword.value, t('status'), status.value ? t(statusKey[status.value]) : t('all')])
  rows.push([t('code'), t('name'), t('unit'), t('quantity'), t('reserved'), t('available'), t('threshold'), t('shortage'), t('status'), t('updated')])
  for (const item of inventory.value?.items ?? []) rows.push([item.code, item.name, item.unit, item.quantity, item.reservedQuantity ?? 0, item.availableQuantity ?? item.quantity, item.reorderPoint, item.shortage, t(statusKey[item.status]), item.updatedAt])
  downloadCsv(`inventory-${view.value}-${new Date().toISOString().slice(0, 10)}-p${page.value}.csv`, rows)
}
onMounted(() => { if (view.value === 'inventory') void load() })
watch(view, (value) => { notice.value = false; if (value === 'inventory') void load() })
onBeforeUnmount(() => { sequence++ })
</script>

<template>
  <section class="inventory-page" :lang="locale">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p class="text-sm text-muted-foreground">{{ t('subtitle') }}</p>
        <p v-if="storeName" class="mt-1 text-sm font-medium">{{ storeName }}</p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <label class="sr-only" for="inventory-language">{{ t('language') }}</label>
        <select id="inventory-language" v-model="locale" class="control"><option value="zh-CN">简体中文</option><option value="en-US">English</option></select>
        <Button v-if="view === 'inventory'" variant="outline" :disabled="loading" @click="load">{{ t('refresh') }}</Button>
        <Button v-if="view === 'inventory'" :disabled="!storeId || loading || !!errorKey" @click="edit()">{{ t('newItem') }}</Button>
      </div>
    </div>
    <p v-if="notice" role="status" class="text-sm text-emerald-700">{{ t('saved') }}</p>
    <template v-if="view === 'inventory' && inventory && !errorKey">
      <div class="grid grid-cols-3 gap-3" :aria-label="t('summaryHint')">
        <button v-for="metric in [{ key: 'all' as const, value: inventory.summary.total, filter: '' as const }, { key: 'low' as const, value: inventory.summary.low, filter: 'LOW' as const }, { key: 'out' as const, value: inventory.summary.out, filter: 'OUT' as const }]" :key="metric.key" class="metric" :class="{ chosen: status === metric.filter }" :aria-pressed="status === metric.filter" :disabled="loading" @click="filter(metric.filter)">
          <span class="block min-h-8 text-xs text-muted-foreground sm:min-h-0 sm:text-sm">{{ t(metric.key) }}</span><strong class="mt-2 block text-2xl font-semibold tabular-nums">{{ format(metric.value) }}</strong>
        </button>
      </div>
      <p class="text-xs text-muted-foreground">{{ t('summaryHint') }}</p>
    </template>
    <div class="panel">
      <div class="flex flex-wrap items-center justify-between gap-3 border-b p-4">
        <div class="flex flex-wrap gap-1" :aria-label="t('title')">
          <Button :variant="view === 'inventory' ? 'secondary' : 'ghost'" :aria-pressed="view === 'inventory'" @click="switchView('inventory')">{{ t('inventory') }}</Button>
          <Button :variant="view === 'history' ? 'secondary' : 'ghost'" :aria-pressed="view === 'history'" @click="showHistory()">{{ t('history') }}</Button>
          <Button :variant="view === 'report' ? 'secondary' : 'ghost'" :aria-pressed="view === 'report'" @click="switchView('report')">{{ t('report') }}</Button>
          <Button :variant="view === 'alerts' ? 'secondary' : 'ghost'" :aria-pressed="view === 'alerts'" @click="switchView('alerts')">{{ locale === 'en-US' ? 'Stock alerts' : '预警中心' }}</Button>
          <Button :variant="view === 'holds' ? 'secondary' : 'ghost'" :aria-pressed="view === 'holds'" @click="switchView('holds')">{{ locale === 'en-US' ? 'Ingredient holds' : '原料占用' }}</Button>
          <Button :variant="view === 'recipes' ? 'secondary' : 'ghost'" :aria-pressed="view === 'recipes'" @click="switchView('recipes')">{{ t('recipes') }}</Button>
        </div>
        <Button v-if="view === 'inventory'" variant="outline" size="sm" :disabled="loading || !!errorKey || !hasRows" @click="exportPage">{{ t('export') }}</Button>
      </div>
      <InventoryHolds v-if="view === 'holds'" />
      <InventoryAlerts v-else-if="view === 'alerts'" :store-id="storeId" :store-name="storeName" @stock="stockFromAlert" />
      <InventoryRecipes v-else-if="view === 'recipes'" :store-id="storeId" />
      <InventoryActivity v-else-if="view !== 'inventory'" :key="view" :store-id="storeId" :store-name="storeName" :mode="view" />
      <template v-else>
        <form class="flex flex-wrap items-center gap-2 border-b p-4" @submit.prevent="search">
          <label class="sr-only" for="inventory-search">{{ t('search') }}</label>
          <input id="inventory-search" v-model="keyword" type="search" maxlength="120" class="control w-full sm:w-64" :placeholder="t('search')" />
          <Button type="submit" variant="outline" :disabled="loading">{{ t('searchButton') }}</Button>
          <label class="sr-only" for="inventory-status">{{ t('status') }}</label>
          <select id="inventory-status" :value="status" class="control" :disabled="loading" @change="filter(($event.target as HTMLSelectElement).value as InventoryStatus | '')">
            <option value="">{{ t('all') }}</option><option value="HEALTHY">{{ t('healthy') }}</option><option value="LOW">{{ t('low') }}</option><option value="OUT">{{ t('out') }}</option>
          </select>
        </form>
        <div v-if="loading" class="empty" role="status">{{ t('loading') }}</div>
        <div v-else-if="errorKey" class="empty" role="alert"><p>{{ t(errorKey) }}</p><Button variant="outline" class="mt-3" @click="load">{{ t('refresh') }}</Button></div>
        <div v-else-if="!hasRows" class="empty">
          <p class="font-medium text-foreground">{{ t(inventory?.summary.total === 0 ? 'empty' : 'noResults') }}</p>
          <p class="mt-2">{{ t(inventory?.summary.total === 0 ? 'emptyHint' : 'search') }}</p>
          <Button v-if="view === 'inventory'" variant="outline" class="mt-4" @click="inventory?.summary.total === 0 ? edit() : clear()">{{ t(inventory?.summary.total === 0 ? 'newItem' : 'clear') }}</Button>
        </div>
        <div v-else class="overflow-x-auto" tabindex="0" :aria-label="t('inventory')">
          <table>
            <thead><tr><th>{{ t('name') }}</th><th>{{ t('status') }}</th><th class="number">{{ t('quantity') }}</th><th class="number">{{ t('reserved') }}</th><th class="number">{{ t('available') }}</th><th class="number">{{ t('threshold') }}</th><th class="number">{{ t('shortage') }}</th><th>{{ t('updated') }}</th><th class="text-right">{{ t('actions') }}</th></tr></thead>
            <tbody><tr v-for="item in inventory?.items" :key="item.id">
              <td><span class="font-medium">{{ item.name }}</span><span class="mt-1 block font-mono text-xs text-muted-foreground">{{ item.code }}</span></td>
              <td><span class="stock-status" :data-status="item.status">{{ t(statusKey[item.status]) }}</span></td>
              <td class="number font-semibold">{{ format(item.quantity) }} <span class="text-xs font-normal text-muted-foreground">{{ item.unit }}</span></td>
              <td class="number">{{ format(item.reservedQuantity ?? 0) }}</td><td class="number font-semibold">{{ format(item.availableQuantity ?? item.quantity) }}</td><td class="number">{{ format(item.reorderPoint) }}</td><td class="number">{{ format(item.shortage) }}</td><td class="text-xs text-muted-foreground">{{ date(item.updatedAt) }}</td>
              <td><div class="flex justify-end gap-1"><Button variant="outline" size="sm" :aria-label="`${t('adjust')} ${item.name}`" @click="edit(item)">{{ t('adjust') }}</Button><Button variant="ghost" size="sm" :aria-label="`${t('records')} ${item.name}`" @click="showHistory(item)">{{ t('records') }}</Button></div></td>
            </tr></tbody>
          </table>

        </div>
        <div v-if="!loading && !errorKey" class="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm text-muted-foreground">
          <p>{{ format(total) }} {{ t('total') }} · {{ t('page') }} {{ page }} / {{ pageCount }}</p><div class="flex gap-2"><Button variant="outline" size="sm" :disabled="page <= 1" @click="go(page - 1)">{{ t('previous') }}</Button><Button variant="outline" size="sm" :disabled="page >= pageCount" @click="go(page + 1)">{{ t('next') }}</Button></div>
        </div>
      </template>
    </div>
    <p class="text-xs leading-5 text-muted-foreground">{{ t('scopeHint') }}<template v-if="view !== 'report'"><br />{{ t('reportHint') }}</template></p>
    <InventoryEditor v-model:open="editorOpen" :store-id="storeId" :item="selectedItem" @saved="saved" />
  </section>
</template>

<style scoped>
.inventory-page { display: grid; grid-template-columns: minmax(0, 1fr); min-width: 0; gap: 1rem; }
.panel, .metric { background: var(--ld-bg-elevated); border: 1px solid var(--ld-border-default); border-radius: .5rem; }
.metric { padding: 1rem; text-align: start; transition: border-color .15s; }
.metric:hover, .metric.chosen { border-color: var(--ld-color-primary); }
.control { min-height: 2.25rem; max-width: 100%; border: 1px solid var(--ld-border-default); border-radius: .375rem; padding: .5rem .75rem; background: var(--ld-bg-elevated); color: var(--ld-text-heading); font-size: .875rem; }
.control:focus-visible, .metric:focus-visible { outline: 2px solid var(--ld-color-primary); outline-offset: 2px; }
.empty { padding: 3rem 1.5rem; text-align: center; color: var(--ld-text-muted); font-size: .875rem; }
table { width: 100%; text-align: start; border-collapse: collapse; font-size: .875rem; }
th { color: var(--ld-text-muted); font-size: .75rem; font-weight: 500; background: var(--ld-bg-muted); white-space: nowrap; }
th, td { padding: .875rem 1rem; border-bottom: 1px solid var(--ld-border-default); }
tr:last-child td { border-bottom: 0; }
tbody tr:hover { background: var(--ld-bg-muted); }
.number { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
.stock-status { display: inline-block; white-space: nowrap; font-size: .75rem; border-radius: .25rem; padding: .25rem .5rem; background: #ecfdf5; color: #065f46; }
.stock-status[data-status='LOW'] { background: #fffbeb; color: #92400e; }
.stock-status[data-status='OUT'] { background: #fef2f2; color: #991b1b; }
</style>
