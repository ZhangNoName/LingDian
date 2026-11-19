<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { InventoryItemContract, InventoryPage, InventoryStatus } from '@lingdian/contracts'
import { Button } from '@lingdian/console-ui/button'
import { Input } from '@lingdian/console-ui/input'
import { SelectField } from '@lingdian/console-ui/select'
import { useLocale } from '@/i18n/locale'
import { listInventory } from '@/services/inventory'
import InventoryEditor from '../InventoryEditor.vue'
import { en, zh, type MessageKey } from '../messages'
import { useLifecycleLocale } from '../lifecycle/locale'
import { downloadCsv } from '../report'
import MaterialDetail from './MaterialDetail.vue'
import StockRows from './StockRows.vue'
import { useMaterialLocale } from './locale'
import {
  canonicalStock,
  materialActivityTarget,
  materialRecordId,
  parseStockState,
  stockTarget,
  type StockState,
} from './state'
const props = defineProps<{ storeId: string; storeName: string }>(),
  emit = defineEmits<{ replenish: [id: string] }>()
const route = useRoute(),
  router = useRouter(),
  { locale } = useLocale(),
  { t: lt } = useLifecycleLocale(),
  { t: mt } = useMaterialLocale()
const t = (key: MessageKey) => (locale.value === 'en-US' ? en : zh)[key]
const state = computed(() => parseStockState(route.query)),
  id = computed(() => materialRecordId(route.query.materialId))
const keyword = ref(''),
  status = ref<StockState['status']>(''),
  scope = ref<StockState['lifecycle']>('ACTIVE'),
  filtersOpen = ref(false)
const inventory = ref<InventoryPage>(),
  loading = ref(true),
  failed = ref(false),
  notice = ref(false),
  editorOpen = ref(false),
  selected = ref<InventoryItemContract>()
const dirty = computed(
  () =>
    keyword.value.trim() !== state.value.keyword ||
    status.value !== state.value.status ||
    scope.value !== state.value.lifecycle,
)
const pages = computed(() => Math.max(1, Math.ceil((inventory.value?.total ?? 0) / 20)))
const statusKey: Record<InventoryStatus, MessageKey> = { HEALTHY: 'healthy', LOW: 'low', OUT: 'out' }
const filterSummary = computed(() =>
  [
    state.value.keyword,
    state.value.status ? t(statusKey[state.value.status]) : '',
    state.value.lifecycle !== 'ACTIVE' ? lt(state.value.lifecycle) : '',
  ]
    .filter(Boolean)
    .join(' · '),
)
const number = (value: number) => value.toLocaleString(locale.value, { maximumFractionDigits: 3 })
let sequence = 0,
  disposed = false
function navigate(next: StockState, selectedId = id.value, replace = false) {
  const target = { query: stockTarget(route.query, next, selectedId) }
  return replace ? router.replace(target) : router.push(target)
}
async function load() {
  const token = ++sequence,
    snapshot = state.value
  loading.value = true
  failed.value = false
  try {
    const result = await listInventory(props.storeId, {
      page: snapshot.page,
      pageSize: 20,
      keyword: snapshot.keyword,
      status: snapshot.status || undefined,
      lifecycle: snapshot.lifecycle,
    })
    if (token !== sequence) return
    const last = Math.max(1, Math.ceil(result.total / 20))
    if (snapshot.page > last) {
      await navigate({ ...snapshot, page: last }, id.value, true)
      return
    }
    inventory.value = result
  } catch {
    if (token === sequence) failed.value = true
  } finally {
    if (token === sequence) loading.value = false
  }
}
watch(
  [() => props.storeId, () => JSON.stringify(state.value)],
  async () => {
    const token = ++sequence,
      next = state.value
    keyword.value = next.keyword
    status.value = next.status
    scope.value = next.lifecycle
    if (!canonicalStock(route.query, next, id.value)) await navigate(next, id.value, true)
    if (!disposed && token === sequence) await load()
  },
  { immediate: true },
)
watch(
  () => route.query.materialId,
  () => {
    if (!canonicalStock(route.query, state.value, id.value)) void navigate(state.value, id.value, true)
  },
)
async function apply() {
  filtersOpen.value = false
  const next = {
    keyword: keyword.value.trim(),
    status: scope.value === 'ARCHIVED' ? ('' as const) : status.value,
    lifecycle: scope.value,
    page: 1,
  }
  if (canonicalStock(route.query, next, id.value)) await load()
  else await navigate(next)
}
function clear() {
  keyword.value = ''
  status.value = ''
  scope.value = 'ACTIVE'
  filtersOpen.value = false
  const next = parseStockState({})
  if (canonicalStock(route.query, next, '')) void load()
  else void navigate(next, '')
}
function quickFilter(value: InventoryStatus | '') {
  const next = { ...state.value, lifecycle: 'ACTIVE' as const, status: value, page: 1 }
  keyword.value = next.keyword
  status.value = value
  scope.value = 'ACTIVE'
  filtersOpen.value = false
  if (canonicalStock(route.query, next, '')) void load()
  else void navigate(next, '')
}
function edit(item?: InventoryItemContract) {
  selected.value = item
  editorOpen.value = true
  notice.value = false
}
function detail(item: InventoryItemContract) {
  void navigate(state.value, item.id)
}
async function closeDetail() {
  await navigate(state.value, '')
  if (!disposed) await load()
}
function activity(itemId: string, mode: 'history' | 'report') {
  void router.push({ query: materialActivityTarget(route.query, itemId, mode) })
}
function saved() {
  notice.value = true
  window.dispatchEvent(new CustomEvent('inventory-alerts-changed', { detail: { storeId: props.storeId } }))
  void load()
}
function exportPage() {
  if (!inventory.value || loading.value || failed.value || dirty.value) return
  const snapshot = state.value
  const rows: (string | number)[][] = [
    [t('store'), props.storeName, props.storeId],
    [t('currentPage'), snapshot.page, t('total'), inventory.value.total],
    [t('time'), new Date().toISOString()],
    [lt('scope'), lt(snapshot.lifecycle)],
    [t('search'), snapshot.keyword, t('status'), snapshot.status ? t(statusKey[snapshot.status]) : t('all')],
    [
      t('code'),
      t('name'),
      t('unit'),
      lt('scope'),
      t('quantity'),
      t('reserved'),
      t('available'),
      t('threshold'),
      t('shortage'),
      t('status'),
      t('updated'),
    ],
  ]
  for (const item of inventory.value.items)
    rows.push([
      item.code,
      item.name,
      item.unit,
      lt(item.isActive === false ? 'ARCHIVED' : 'ACTIVE'),
      item.quantity,
      item.reservedQuantity ?? 0,
      item.availableQuantity ?? item.quantity,
      item.reorderPoint,
      item.isActive === false ? '' : item.shortage,
      t(statusKey[item.status]),
      item.updatedAt,
    ])
  downloadCsv(`inventory-stock-${new Date().toISOString().slice(0, 10)}-p${snapshot.page}.csv`, rows)
}
onBeforeUnmount(() => {
  disposed = true
  sequence++
})
</script>
<template>
  <section class="min-w-0">
    <div class="grid grid-cols-3 gap-3 border-b p-4" :aria-label="mt('summary')">
      <Button
        type="button"
        variant="ghost"
        v-for="metric in [
          { key: 'all' as const, value: inventory?.summary.total, status: '' as const },
          { key: 'low' as const, value: inventory?.summary.low, status: 'LOW' as const },
          { key: 'out' as const, value: inventory?.summary.out, status: 'OUT' as const },
        ]"
        :key="metric.key"
        class="block h-auto min-w-0 whitespace-normal rounded-md p-2 text-left"
        :class="state.lifecycle === 'ACTIVE' && state.status === metric.status ? 'bg-muted' : ''"
        :aria-pressed="state.lifecycle === 'ACTIVE' && state.status === metric.status"
        :disabled="loading"
        @click="quickFilter(metric.status)"
      >
        <span class="block min-h-8 text-xs text-muted-foreground sm:min-h-0">{{
          metric.key === 'all' ? lt('ACTIVE') : t(metric.key)
        }}</span
        ><strong class="mt-2 block text-2xl font-semibold tabular-nums">{{
          loading || failed ? '—' : number(metric.value ?? 0)
        }}</strong>
      </Button>
    </div>
    <p class="px-4 pt-2 text-xs text-muted-foreground">{{ mt('summary') }}</p>
    <p v-if="notice" role="status" class="px-4 pt-3 text-sm text-emerald-700">{{ t('saved') }}</p>
    <div class="flex flex-wrap gap-2 px-4 py-3 md:hidden">
      <Button
        size="sm"
        variant="outline"
        :aria-expanded="filtersOpen"
        aria-controls="stock-list-filters"
        @click="filtersOpen = !filtersOpen"
        >{{ mt(filtersOpen ? 'hideFilters' : 'showFilters') }}</Button
      ><Button size="sm" variant="ghost" :disabled="loading || dirty" @click="load">{{ t('refresh') }}</Button
      ><Button size="sm" :disabled="loading || failed" @click="edit()">{{ t('newItem') }}</Button>
      <p v-if="filterSummary" class="w-full break-words text-xs text-muted-foreground">{{ filterSummary }}</p>
    </div>
    <form
      id="stock-list-filters"
      class="flex-wrap items-end gap-3 border-b p-4 md:flex"
      :class="filtersOpen ? 'flex' : 'hidden'"
      @submit.prevent="apply"
    >
      <label>{{ t('search') }}<Input v-model="keyword" type="search" maxlength="120" /></label
      ><label
        >{{ lt('scope')
        }}<SelectField
          v-model="scope"
          :aria-label="lt('scope')"
          :disabled="loading"
          :options="[
            { value: 'ACTIVE', label: lt('ACTIVE') },
            { value: 'ARCHIVED', label: `${lt('ARCHIVED')} (${inventory?.summary.archived ?? 0})` },
            { value: 'ALL', label: lt('ALL') },
          ]"
        /></label
      ><label v-if="scope !== 'ARCHIVED'"
        >{{ t('status')
        }}<SelectField
          v-model="status"
          :aria-label="t('status')"
          :disabled="loading"
          :options="[
            { value: '', label: t('all') },
            { value: 'HEALTHY', label: t('healthy') },
            { value: 'LOW', label: t('low') },
            { value: 'OUT', label: t('out') },
          ]"
        /></label
      ><Button type="submit" variant="outline" :disabled="loading">{{ t('searchButton') }}</Button
      ><Button type="button" variant="ghost" :disabled="loading" @click="clear">{{ t('clear') }}</Button
      ><Button
        type="button"
        variant="ghost"
        class="hidden md:inline-flex"
        :disabled="loading || dirty"
        @click="load"
        >{{ t('refresh') }}</Button
      ><Button
        type="button"
        class="hidden md:ml-auto md:inline-flex"
        :disabled="loading || failed"
        @click="edit()"
        >{{ t('newItem') }}</Button
      >
    </form>
    <div
      class="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2 text-xs text-muted-foreground"
    >
      <span
        >{{ lt(state.lifecycle) }} · {{ loading || failed ? '—' : number(inventory?.total ?? 0) }}
        {{ t('total') }}</span
      ><Button
        variant="ghost"
        size="sm"
        :disabled="loading || failed || dirty || !inventory?.total"
        @click="exportPage"
        >{{ t('export') }}</Button
      >
    </div>
    <p v-if="dirty" role="status" class="border-b px-4 py-2 text-xs text-amber-800">{{ t('unapplied') }}</p>
    <p v-if="loading" role="status" class="p-8 text-center text-sm text-muted-foreground">
      {{ t('loading') }}
    </p>
    <div v-else-if="failed" role="alert" class="grid justify-items-start gap-3 p-8 text-sm text-destructive">
      <p>{{ t('loadFailed') }}</p>
      <Button variant="outline" @click="load">{{ t('refresh') }}</Button>
    </div>
    <div
      v-else-if="!inventory?.total"
      class="grid justify-items-center gap-3 p-8 text-center text-sm text-muted-foreground"
    >
      <p>
        {{
          state.lifecycle === 'ARCHIVED'
            ? lt('noArchived')
            : !inventory?.summary.total && !inventory?.summary.archived
              ? t('empty')
              : t('noResults')
        }}
      </p>
      <p v-if="!inventory?.summary.total && !inventory?.summary.archived">{{ t('emptyHint') }}</p>
      <Button
        v-if="!inventory?.summary.total && !inventory?.summary.archived"
        variant="outline"
        @click="edit()"
        >{{ t('newItem') }}</Button
      ><Button v-else variant="outline" @click="clear">{{ t('clear') }}</Button>
    </div>
    <StockRows
      v-else-if="inventory"
      :items="inventory.items"
      @detail="detail"
      @edit="edit"
      @history="activity($event, 'history')"
    />
    <div
      v-if="!loading && !failed"
      class="flex flex-wrap items-center justify-between gap-3 border-t p-4 text-sm text-muted-foreground"
    >
      <span>{{ t('page') }} {{ state.page }} / {{ pages }}</span>
      <div class="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          :disabled="dirty || state.page <= 1"
          @click="navigate({ ...state, page: state.page - 1 })"
          >{{ t('previous') }}</Button
        ><Button
          size="sm"
          variant="outline"
          :disabled="dirty || state.page >= pages"
          @click="navigate({ ...state, page: state.page + 1 })"
          >{{ t('next') }}</Button
        >
      </div>
    </div>
    <MaterialDetail
      v-if="id"
      :key="storeId + ':' + id"
      :id="id"
      :store-id="storeId"
      :store-name="storeName"
      @close="closeDetail"
      @saved="saved"
      @history="activity($event, 'history')"
      @report="activity($event, 'report')"
      @trend="
        router.push({
          query: { ...materialActivityTarget(route.query, $event, 'report'), reportView: 'trend' },
        })
      "
      @replenish="$emit('replenish', $event)"
    />
    <InventoryEditor v-model:open="editorOpen" :store-id="storeId" :item="selected" @saved="saved" />
  </section>
</template>
<style scoped>
label {
  display: grid;
  min-width: 0;
  gap: 0.375rem;
  font-size: 0.75rem;
  color: var(--ld-text-muted);
}
</style>
