<script setup lang="ts">
import MerchantDatePicker from '@/components/MerchantDatePicker.vue'
import DataActionButton from '@/components/DataActionButton.vue'
import TablePagination from '@/components/table/TablePagination.vue'
import TableAction from '@/components/table/TableAction.vue'
import { ChartLine, ClipboardList, FileText, History } from '@lingdian/icons/web'
import { computed, defineAsyncComponent, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { InventoryMovementKind, InventoryMovementPage, InventoryPeriodReport, InventoryReportRow } from '@lingdian/contracts'
import { Button } from '@lingdian/console-ui/button'
import { Input } from '@lingdian/console-ui/input'
import { SelectField } from '@lingdian/console-ui/select'
import { Table } from '@lingdian/console-ui/table'
import { useLocale } from '@/i18n/locale'
import { useWarehouseViewLock } from '@/config/warehouse-view-lock'
import { getInventoryReport, listInventoryMovements } from '@/services/inventory'
import { activityQuery, dateInput, defaultActivityState, movementKinds, parseActivityState, editedActivityPeriod, sameActivityQuery, type ActivityState } from './activity-state'
import { en, zh, type MessageKey } from './messages'
import { downloadCsv } from './report'
import { materialRecordId, returnMaterialTarget, inventoryNavigationContext } from './materials/state'
import { useMaterialLocale } from './materials/locale'
import InventoryAnalysis from './analysis/InventoryAnalysis.vue'
import { analysisQuery, parseAnalysisState } from './analysis/state'
import { parseTrendView, trendTarget, trendReturnContext, returnTrendTarget } from './trend/state'
import { useTrendLocale } from './trend/locale'
const InventoryTrend = defineAsyncComponent(() => import('./trend/InventoryTrend.vue'))

const props = defineProps<{ storeId: string; storeName: string; mode: 'history' | 'report' }>()
const route = useRoute(), router = useRouter()
const { locale } = useLocale()
const { t: mt } = useMaterialLocale()
const { t: tt } = useTrendLocale()
const trendMode = computed(() => props.mode === 'report' && route.query.reportView === 'trend')
const trendSource = computed(() => trendReturnContext(route.query))
const analysisMode = computed(() => props.mode === 'report' && route.query.reportView === 'analysis')
function viewQuery(applied: ActivityState) { if (trendMode.value) return trendTarget(route.query, applied); return { ... (props.mode === 'history' ? trendSource.value : {}), view: props.mode, ...inventoryNavigationContext(route.query), ...activityQuery(applied), ...(analysisMode.value ? analysisQuery(parseAnalysisState(route.query)) : {}) } }
function openTrend(itemId = state.value.itemId) { if (itemId) void router.push({ query: trendTarget(route.query, state.value, itemId, { ...parseTrendView(route.query), day: '', page: 1 }) }) }
function reset() { const query = { ...(props.mode === 'history' ? trendSource.value : {}), view: props.mode, ...inventoryNavigationContext(route.query), ...activityQuery({ ...defaultActivityState(), pageSize: state.value.pageSize }), ...(analysisMode.value ? { reportView: 'analysis' } : {}) }; if (sameActivityQuery(route.query, query)) void load(true); else void router.push({ query }) }
const t = (key: MessageKey) => (locale.value === 'en-US' ? en : zh)[key]
const state = computed(() => {
  const value = parseActivityState(route.query)
  return props.mode === 'report' ? { ...value, kind: '' as const, ...(trendMode.value ? { keyword: '', page: 1 } : {}) } : value
})
const from = ref(''), to = ref(''), keyword = ref(''), kind = ref<InventoryMovementKind | ''>('')
const loading = ref(true), errorKey = ref<MessageKey | ''>('')
const report = ref<InventoryPeriodReport>(), history = ref<InventoryMovementPage>()
const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
const kindKey: Record<InventoryMovementKind, MessageKey> = { RECEIVE: 'receive', ISSUE: 'issue', LOSS: 'loss', COUNT: 'count', THRESHOLD: 'setThreshold', RESERVE: 'reserve', RELEASE: 'release' }
const columns = ['opening', 'received', 'issued', 'lost', 'countGain', 'countLoss', 'closing'] as const
const total = computed(() => props.mode === 'report' ? report.value?.rows.length ?? 0 : history.value?.total ?? 0)
const pageCount = computed(() => Math.max(1, Math.ceil(total.value / (state.value.pageSize ?? 20))))
const reportRows = computed(() => report.value?.rows.slice((state.value.page - 1) * (state.value.pageSize ?? 20), state.value.page * (state.value.pageSize ?? 20)) ?? [])
const format = (value: number) => value.toLocaleString(locale.value, { maximumFractionDigits: 3 })
const date = (value: string) => new Intl.DateTimeFormat(locale.value, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
const dirty = computed(() => from.value !== dateInput(new Date(state.value.startAt)) || to.value !== dateInput(new Date(Date.parse(state.value.endAt) - 1)) || keyword.value.trim() !== state.value.keyword || (props.mode === 'history' && kind.value !== state.value.kind))
useWarehouseViewLock(() => props.mode === 'report' && !trendMode.value && (loading.value || dirty.value))
let sequence = 0, reportKey = ''

async function navigate(next: ActivityState, replace = false) {
  const target = { query: viewQuery(next) }
  if (sameActivityQuery(route.query, target.query)) await load(true)
  else if (replace) await router.replace(target)
  else await router.push(target)
}
async function apply() {
  try { await navigate({ ...state.value, ...editedActivityPeriod(state.value, from.value, to.value), keyword: keyword.value.trim(), kind: props.mode === 'history' ? kind.value : '', page: 1 }) }
  catch (error) { errorKey.value = error instanceof Error && error.message === 'inventory.invalidPeriod' ? 'inventory.invalidPeriod' : 'loadFailed' }
}
async function load(force = false) {
  const current = ++sequence
  if (trendMode.value) { loading.value = false; return }
  errorKey.value = ''
  const applied = state.value
  const key = JSON.stringify({ ...applied, page: 1, pageSize: undefined, kind: '' })
  if (props.mode === 'report' && !force && report.value && key === reportKey) { loading.value = false; return }
  loading.value = true
  try {
    const filter = { startAt: applied.startAt, endAt: applied.endAt, itemId: applied.itemId || undefined, keyword: applied.keyword || undefined }
    if (props.mode === 'report') {
      const result = await getInventoryReport(props.storeId, filter)
      if (current !== sequence) return
      report.value = result; reportKey = key
    } else {
      const result = await listInventoryMovements(props.storeId, applied.page, { ...filter, kind: applied.kind || undefined }, applied.pageSize)
      if (current !== sequence) return
      history.value = result
    }
    if (applied.page > pageCount.value) await navigate({ ...applied, page: pageCount.value }, true)
  } catch (error) {
    if (current === sequence) {
      const message = error instanceof Error ? error.message : ''
      errorKey.value = Object.hasOwn(zh, message) ? message as MessageKey : 'loadFailed'
    }
  } finally { if (current === sequence) loading.value = false }
}
function exportRows() {
  const applied = state.value
  const rows: (string | number)[][] = [[t('store'), props.storeName, props.storeId], [t('period'), applied.startAt, applied.endAt], [t('timeZone'), timeZone], [t('search'), applied.keyword], [t('name'), applied.itemId || t('all')]]
  if (props.mode === 'report' && report.value) {
    rows.push([t('generated'), report.value.generatedAt], [t('reportEquation')])
    rows.push([t('code'), t('name'), t('unit'), ...columns.map((key) => t(key)), t('movementCount')])
    for (const row of report.value.rows) rows.push([row.code, row.name, row.unit, ...columns.map((key) => row[key]), row.movementCount])
  } else {
    rows.push([t('currentPage'), applied.page, t('total'), total.value], [t('operation'), applied.kind ? t(kindKey[applied.kind]) : t('allOperations')])
    rows.push([t('time'), t('code'), t('name'), t('unit'), t('operation'), t('amount'), t('before'), t('after'), t('reserved') + ' · ' + t('before'), t('reserved') + ' · ' + t('after'), t('threshold') + ' · ' + t('before'), t('threshold') + ' · ' + t('after'), t('actor'), t('reason')])
    for (const row of history.value?.items ?? []) rows.push([row.createdAt, row.itemCode, row.itemName, row.unit, t(kindKey[row.kind]), row.amount, row.quantityBefore, row.quantityAfter, row.reservedBefore ?? 0, row.reservedAfter ?? 0, row.reorderPointBefore, row.reorderPointAfter, row.actorId, row.reason])
  }
  downloadCsv(`inventory-${props.mode}-${applied.startAt.slice(0, 10)}-${applied.endAt.slice(0, 10)}${props.mode === 'history' ? '-p' + applied.page : ''}.csv`, rows)
}
function drillDown(row: InventoryReportRow) {
  void router.push({ query: { view: 'history', ...inventoryNavigationContext(route.query), ...activityQuery({ ...state.value, itemId: row.itemId, kind: '', page: 1 }) } })
}
watch(() => [route.fullPath, props.mode], async () => {
  const applied = state.value
  from.value = dateInput(new Date(applied.startAt)); to.value = dateInput(new Date(Date.parse(applied.endAt) - 1))
  keyword.value = applied.keyword; kind.value = applied.kind
  const canonical = { query: viewQuery(applied) }
  if (!sameActivityQuery(route.query, canonical.query)) { await router.replace(canonical); return }
  await load()
}, { immediate: true })
onBeforeUnmount(() => { sequence++ })
</script>

<template>
  <section class="min-w-0" :aria-label="t(mode === 'report' ? 'report' : 'history')">
    <div v-if="materialRecordId(route.query.materialId)" class="border-b px-4 py-3"><Button type="button" variant="outline" size="sm" @click="router.push({ query:returnMaterialTarget(route.query) })">{{ mt('back') }}</Button></div>
    <div v-if="mode === 'history' && trendSource.trendItem" class="border-b px-4 py-3"><Button size="sm" variant="outline" @click="router.push({ query: returnTrendTarget(route.query) })">{{ tt('back') }}</Button></div>
    <InventoryTrend v-if="trendMode" :key="storeId" :store-id="storeId" :store-name="storeName" :state="state" />
    <template v-else>
    <form class="flex flex-wrap items-end gap-3 px-4 pt-4" @submit.prevent="apply">
      <MerchantDatePicker :label="t('from')" v-model="from" required />
      <MerchantDatePicker :label="t('to')" v-model="to" required :min="from" />
      <label v-if="mode === 'history'">{{ t('operation') }}<SelectField
          v-model="kind"
          :aria-label="t('operation')"
          :options="[
            { value: '', label: t('allOperations') },
            ...movementKinds.map((value) => ({ value, label: t(kindKey[value]) })),
          ]"
        /></label>
      <label class="grow sm:grow-0">{{ t('search') }}<Input v-model="keyword" type="search" maxlength="120" /></label>
      <Button type="submit" variant="outline" :disabled="loading">{{ t('apply') }}</Button>
      <Button type="button" variant="ghost" :disabled="loading" @click="reset">{{ t('reset') }}</Button>
      <DataActionButton action="export" :label="t(mode === 'report' ? 'exportReport' : 'export')" v-if="!analysisMode" class="sm:ml-auto" :disabled="loading || !!errorKey || !total || dirty" @click="exportRows" />
    </form>
    <p v-if="dirty" role="status" class="border-b px-4 py-2 text-xs text-amber-800">{{ t('unapplied') }}</p>
    <div v-if="state.itemId" class="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2 text-sm">
      <span>{{ mode === 'report' ? report?.rows[0]?.name : history?.items[0]?.itemName }}</span>
      <Button variant="ghost" size="sm" @click="navigate({ ...state, itemId: '', page: 1 })">{{ t('allRecords') }}</Button>
    </div>
    <p v-if="loading" class="empty" role="status">{{ t('loading') }}</p>
    <div v-else-if="errorKey" class="empty" role="alert"><p>{{ t(errorKey) }}</p><DataActionButton action="refresh" :label="t('refresh')" class="mt-3" @click="load(true)" /></div>
    <p v-else-if="!total" class="empty">{{ t(mode === 'report' ? 'reportEmpty' : 'noHistory') }}</p>
    <InventoryAnalysis v-else-if="analysisMode && report" :report="report" :state="state" :store-name="storeName" :dirty="dirty" />
    <template v-else>
      <Table framed container-class="mx-4 mt-4" v-if="mode === 'report'" tabindex="0" :aria-label="t('report')" class="border-collapse text-start">
        <thead><tr><th>{{ t('name') }}</th><th>{{ t('unit') }}</th><th v-for="key in columns" :key="key" class="number" :class="{ closing: key === 'closing' }">{{ t(key) }}</th><th class="number">{{ t('movementCount') }}</th><th>{{ t('actions') }}</th></tr></thead>
        <tbody><tr v-for="row in reportRows" :key="row.itemId"><th scope="row" class="material">{{ row.name }}<span class="mt-1 block font-mono text-xs font-normal text-muted-foreground">{{ row.code }}</span></th><td>{{ row.unit }}</td><td v-for="key in columns" :key="key" class="number" :class="{ 'font-semibold': key === 'closing', closing: key === 'closing' }">{{ format(row[key]) }}</td><td class="number">{{ format(row.movementCount) }}</td><td><div class="flex gap-1"><TableAction :icon="History" :label="t('records')" :aria-label="`${t('records')} ${row.name}`" @click="drillDown(row)" /><TableAction :icon="ChartLine" :label="tt('open')" :aria-label="`${tt('open')} ${row.name}`" @click="openTrend(row.itemId)" /></div></td></tr></tbody>
      </Table>
      <Table framed container-class="mx-4 mt-4" v-else tabindex="0" :aria-label="t('history')" class="border-collapse text-start">
        <thead><tr><th>{{ t('time') }}</th><th>{{ t('name') }}</th><th>{{ t('operation') }}</th><th class="number">{{ t('before') }} → {{ t('after') }}</th><th>{{ t('reason') }}</th><th>{{ t('actor') }}</th></tr></thead>
        <tbody><tr v-for="row in history?.items" :key="row.id"><td class="whitespace-nowrap text-xs">{{ date(row.createdAt) }}</td><th scope="row" class="material">{{ row.itemName }}<span class="mt-1 block font-mono text-xs font-normal text-muted-foreground">{{ row.itemCode }}</span></th><td class="whitespace-nowrap">{{ t(kindKey[row.kind]) }}</td><td class="number">{{ row.kind === 'THRESHOLD' ? `${format(row.reorderPointBefore)} → ${format(row.reorderPointAfter)}` : row.kind === 'RESERVE' || row.kind === 'RELEASE' ? `${format(row.reservedBefore ?? 0)} → ${format(row.reservedAfter ?? 0)}` : `${format(row.quantityBefore)} → ${format(row.quantityAfter)}` }} {{ row.unit }}<span v-if="['THRESHOLD', 'RESERVE', 'RELEASE'].includes(row.kind)" class="block text-xs text-muted-foreground">{{ t(row.kind === 'THRESHOLD' ? 'threshold' : 'reserved') }}</span></td><td class="min-w-48 max-w-80 break-words">{{ row.reason }}<TableAction v-if="row.purchaseOrderId" :icon="FileText" :label="t('purchaseOrder')" :to="{ name: 'warehouse', query: { view: 'purchases', purchaseId: row.purchaseOrderId } }" /><TableAction v-if="row.stocktakeId" :icon="ClipboardList" :label="locale === 'en-US' ? 'Stocktake' : '盘点单'" :to="{ name: 'warehouse', query: { view: 'stocktakes', stocktakeId: row.stocktakeId } }" /></td><td class="max-w-48 break-all font-mono text-xs text-muted-foreground">{{ row.actorId }}</td></tr></tbody>
      </Table>
    </template>
    <div v-if="!analysisMode && !loading && !errorKey" class="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm text-muted-foreground">
      <p>{{ format(total) }} {{ t('total') }}</p>
      <div class="flex gap-2"><TablePagination :page-size="state.pageSize ?? 20" @update:page-size="navigate({ ...state, page: 1, pageSize: $event })" :page="state.page" :pages="pageCount" :disabled="loading || dirty" @update:page="navigate({ ...state, page: $event })" /></div>
    </div>
    </template>
  </section>
</template>

<style scoped>
label { display: grid; gap: .375rem; font-size: .75rem; color: var(--ld-text-muted); }
.empty { padding: 3rem 1.5rem; text-align: center; color: var(--ld-text-muted); font-size: .875rem; }
.material { min-width: 9rem; font-weight: 500; text-align: start; }
.number { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
@media (max-width: 640px) {
  .closing { position: sticky; right: 0; z-index: 1; background: var(--ld-bg-elevated); box-shadow: -2px 0 4px rgb(0 0 0 / .06); }
}
</style>
