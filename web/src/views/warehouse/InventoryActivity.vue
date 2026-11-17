<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { InventoryMovementKind, InventoryMovementPage, InventoryPeriodReport, InventoryReportRow } from '@lingdian/contracts'
import { Button } from '@/baseComponents/button'
import { useLocale } from '@/i18n/locale'
import { getInventoryReport, listInventoryMovements } from '@/services/inventory'
import { activityQuery, dateInput, defaultActivityState, movementKinds, parseActivityState, periodFromDates, type ActivityState } from './activity-state'
import { en, zh, type MessageKey } from './messages'
import { downloadCsv } from './report'

const props = defineProps<{ storeId: string; storeName: string; mode: 'history' | 'report' }>()
const route = useRoute(), router = useRouter()
const { locale } = useLocale()
const t = (key: MessageKey) => (locale.value === 'en-US' ? en : zh)[key]
const state = computed(() => {
  const value = parseActivityState(route.query)
  return props.mode === 'report' ? { ...value, kind: '' as const } : value
})
const from = ref(''), to = ref(''), keyword = ref(''), kind = ref<InventoryMovementKind | ''>('')
const loading = ref(true), errorKey = ref<MessageKey | ''>('')
const report = ref<InventoryPeriodReport>(), history = ref<InventoryMovementPage>()
const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
const kindKey: Record<InventoryMovementKind, MessageKey> = { RECEIVE: 'receive', ISSUE: 'issue', LOSS: 'loss', COUNT: 'count', THRESHOLD: 'setThreshold', RESERVE: 'reserve', RELEASE: 'release' }
const columns = ['opening', 'received', 'issued', 'lost', 'countGain', 'countLoss', 'closing'] as const
const total = computed(() => props.mode === 'report' ? report.value?.rows.length ?? 0 : history.value?.total ?? 0)
const pageCount = computed(() => Math.max(1, Math.ceil(total.value / 20)))
const reportRows = computed(() => report.value?.rows.slice((state.value.page - 1) * 20, state.value.page * 20) ?? [])
const format = (value: number) => value.toLocaleString(locale.value, { maximumFractionDigits: 3 })
const date = (value: string) => new Intl.DateTimeFormat(locale.value, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
const dirty = computed(() => from.value !== dateInput(new Date(state.value.startAt)) || to.value !== dateInput(new Date(Date.parse(state.value.endAt) - 1)) || keyword.value.trim() !== state.value.keyword || (props.mode === 'history' && kind.value !== state.value.kind))
let sequence = 0, reportKey = ''

async function navigate(next: ActivityState, replace = false) {
  const target = { query: { view: props.mode, ...activityQuery(next) } }
  if (router.resolve(target).fullPath === route.fullPath) await load(true)
  else if (replace) await router.replace(target)
  else await router.push(target)
}
async function apply() {
  try { await navigate({ ...state.value, ...periodFromDates(from.value, to.value), keyword: keyword.value.trim(), kind: props.mode === 'history' ? kind.value : '', page: 1 }) }
  catch (error) { errorKey.value = error instanceof Error && error.message === 'inventory.invalidPeriod' ? 'inventory.invalidPeriod' : 'loadFailed' }
}
async function load(force = false) {
  const current = ++sequence
  errorKey.value = ''
  const applied = state.value
  const key = JSON.stringify({ ...applied, page: 1, kind: '' })
  if (props.mode === 'report' && !force && report.value && key === reportKey) { loading.value = false; return }
  loading.value = true
  try {
    const filter = { startAt: applied.startAt, endAt: applied.endAt, itemId: applied.itemId || undefined, keyword: applied.keyword || undefined }
    if (props.mode === 'report') {
      const result = await getInventoryReport(props.storeId, filter)
      if (current !== sequence) return
      report.value = result; reportKey = key
    } else {
      const result = await listInventoryMovements(props.storeId, applied.page, { ...filter, kind: applied.kind || undefined })
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
  void router.push({ query: { view: 'history', ...activityQuery({ ...state.value, itemId: row.itemId, kind: '', page: 1 }) } })
}
watch(() => [route.fullPath, props.mode], async () => {
  const applied = state.value
  from.value = dateInput(new Date(applied.startAt)); to.value = dateInput(new Date(Date.parse(applied.endAt) - 1))
  keyword.value = applied.keyword; kind.value = applied.kind
  const canonical = { query: { view: props.mode, ...activityQuery(applied) } }
  if (router.resolve(canonical).fullPath !== route.fullPath) { await router.replace(canonical); return }
  await load()
}, { immediate: true })
onBeforeUnmount(() => { sequence++ })
</script>

<template>
  <section class="min-w-0" :aria-label="t(mode === 'report' ? 'report' : 'history')">
    <form class="flex flex-wrap items-end gap-3 border-b p-4" @submit.prevent="apply">
      <label>{{ t('from') }}<input v-model="from" type="date" required /></label>
      <label>{{ t('to') }}<input v-model="to" type="date" required :min="from" /></label>
      <label v-if="mode === 'history'">{{ t('operation') }}<select v-model="kind" :aria-label="t('operation')"><option value="">{{ t('allOperations') }}</option><option v-for="value in movementKinds" :key="value" :value="value">{{ t(kindKey[value]) }}</option></select></label>
      <label class="grow sm:grow-0">{{ t('search') }}<input v-model="keyword" type="search" maxlength="120" /></label>
      <Button type="submit" variant="outline" :disabled="loading">{{ t('apply') }}</Button>
      <Button type="button" variant="ghost" :disabled="loading" @click="navigate(defaultActivityState())">{{ t('reset') }}</Button>
    </form>
    <div class="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
      <p class="text-xs text-muted-foreground">{{ t('timeZone') }}: {{ timeZone }} · {{ t('period') }}: {{ date(state.startAt) }} → {{ date(state.endAt) }}<span v-if="report && mode === 'report'"> · {{ t('generated') }}: {{ date(report.generatedAt) }}</span></p>
      <Button variant="outline" size="sm" :disabled="loading || !!errorKey || !total || dirty" @click="exportRows">{{ t(mode === 'report' ? 'exportReport' : 'export') }}</Button>
    </div>
    <p v-if="dirty" role="status" class="border-b px-4 py-2 text-xs text-amber-800">{{ t('unapplied') }}</p>
    <div v-if="state.itemId" class="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2 text-sm">
      <span>{{ mode === 'report' ? report?.rows[0]?.name : history?.items[0]?.itemName }}</span>
      <Button variant="ghost" size="sm" @click="navigate({ ...state, itemId: '', page: 1 })">{{ t('allRecords') }}</Button>
    </div>
    <p v-if="loading" class="empty" role="status">{{ t('loading') }}</p>
    <div v-else-if="errorKey" class="empty" role="alert"><p>{{ t(errorKey) }}</p><Button class="mt-3" variant="outline" @click="load(true)">{{ t('refresh') }}</Button></div>
    <p v-else-if="!total" class="empty">{{ t(mode === 'report' ? 'reportEmpty' : 'noHistory') }}</p>
    <div v-else class="overflow-x-auto" tabindex="0" :aria-label="t(mode === 'report' ? 'report' : 'history')">
      <table v-if="mode === 'report'">
        <thead><tr><th>{{ t('name') }}</th><th>{{ t('unit') }}</th><th v-for="key in columns" :key="key" class="number" :class="{ closing: key === 'closing' }">{{ t(key) }}</th><th class="number">{{ t('movementCount') }}</th><th>{{ t('actions') }}</th></tr></thead>
        <tbody><tr v-for="row in reportRows" :key="row.itemId"><th scope="row" class="material">{{ row.name }}<span class="mt-1 block font-mono text-xs font-normal text-muted-foreground">{{ row.code }}</span></th><td>{{ row.unit }}</td><td v-for="key in columns" :key="key" class="number" :class="{ 'font-semibold': key === 'closing', closing: key === 'closing' }">{{ format(row[key]) }}</td><td class="number">{{ format(row.movementCount) }}</td><td><Button variant="ghost" size="sm" @click="drillDown(row)">{{ t('records') }}</Button></td></tr></tbody>
      </table>
      <table v-else>
        <thead><tr><th>{{ t('time') }}</th><th>{{ t('name') }}</th><th>{{ t('operation') }}</th><th class="number">{{ t('before') }} → {{ t('after') }}</th><th>{{ t('reason') }}</th><th>{{ t('actor') }}</th></tr></thead>
        <tbody><tr v-for="row in history?.items" :key="row.id"><td class="whitespace-nowrap text-xs">{{ date(row.createdAt) }}</td><th scope="row" class="material">{{ row.itemName }}<span class="mt-1 block font-mono text-xs font-normal text-muted-foreground">{{ row.itemCode }}</span></th><td class="whitespace-nowrap">{{ t(kindKey[row.kind]) }}</td><td class="number">{{ row.kind === 'THRESHOLD' ? `${format(row.reorderPointBefore)} → ${format(row.reorderPointAfter)}` : row.kind === 'RESERVE' || row.kind === 'RELEASE' ? `${format(row.reservedBefore ?? 0)} → ${format(row.reservedAfter ?? 0)}` : `${format(row.quantityBefore)} → ${format(row.quantityAfter)}` }} {{ row.unit }}<span v-if="['THRESHOLD', 'RESERVE', 'RELEASE'].includes(row.kind)" class="block text-xs text-muted-foreground">{{ t(row.kind === 'THRESHOLD' ? 'threshold' : 'reserved') }}</span></td><td class="min-w-48 max-w-80 break-words">{{ row.reason }}</td><td class="max-w-48 break-all font-mono text-xs text-muted-foreground">{{ row.actorId }}</td></tr></tbody>
      </table>
    </div>
    <div v-if="!loading && !errorKey" class="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm text-muted-foreground">
      <p>{{ format(total) }} {{ t('total') }} · {{ t('page') }} {{ state.page }} / {{ pageCount }}</p>
      <div class="flex gap-2"><Button size="sm" variant="outline" :disabled="loading || dirty || state.page <= 1" @click="navigate({ ...state, page: state.page - 1 })">{{ t('previous') }}</Button><Button size="sm" variant="outline" :disabled="loading || dirty || state.page >= pageCount" @click="navigate({ ...state, page: state.page + 1 })">{{ t('next') }}</Button></div>
    </div>
    <p v-if="mode === 'report'" class="border-t p-4 text-xs leading-5 text-muted-foreground">{{ t('reportEquation') }}<br />{{ t('reportSnapshot') }}</p>
  </section>
</template>

<style scoped>
label { display: grid; gap: .375rem; font-size: .75rem; color: var(--ld-text-muted); }
input, select { min-height: 2.25rem; min-width: 0; max-width: 100%; border: 1px solid var(--ld-border-default); border-radius: .375rem; padding: .5rem .625rem; background: var(--ld-bg-elevated); color: var(--ld-text-heading); font-size: .875rem; }
input:focus-visible, select:focus-visible { outline: 2px solid var(--ld-color-primary); outline-offset: 2px; }
.empty { padding: 3rem 1.5rem; text-align: center; color: var(--ld-text-muted); font-size: .875rem; }
table { width: 100%; border-collapse: collapse; text-align: start; font-size: .875rem; }
th, td { padding: .875rem 1rem; border-bottom: 1px solid var(--ld-border-default); }
thead th { font-size: .75rem; font-weight: 500; color: var(--ld-text-muted); white-space: nowrap; background: var(--ld-bg-muted); }
.material { min-width: 9rem; font-weight: 500; text-align: start; }
.number { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
tbody tr:hover { background: var(--ld-bg-muted); }
@media (max-width: 640px) {
  .closing { position: sticky; right: 0; z-index: 1; background: var(--ld-bg-elevated); box-shadow: -2px 0 4px rgb(0 0 0 / .06); }
}
</style>
