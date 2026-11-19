<script setup lang="ts">
import FilterToggle from '@/components/FilterToggle.vue'
import MerchantDatePicker from '@/components/MerchantDatePicker.vue'
import DataActionButton from '@/components/DataActionButton.vue'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import type { MerchantDashboardSnapshot } from '@lingdian/contracts'
import { Button } from '@lingdian/console-ui/button'
import { Card } from '@lingdian/console-ui/card'
import { Table } from '@lingdian/console-ui/table'
import { merchantStore } from '@/auth/merchant-store'
import { useLocale } from '@/i18n/locale'
import { getMerchantDashboard } from '@/services/dashboard'
import { downloadCsv } from '@/views/warehouse/report'
import { dateInput, periodFromDates, dashboardPeriodPreset, parseDashboardPeriod } from './state'
import { en, zh, type Key } from './messages'
const { locale } = useLocale(), route = useRoute(), router = useRouter()
const t = (key: Key) => (locale.value === 'en-US' ? en : zh)[key]
const filtersOpen = ref(false)
const result = ref<MerchantDashboardSnapshot>(), loading = ref(true), error = ref<Key>(), from = ref(''), to = ref('')
const period = ref(parseDashboardPeriod(route.query))
const storeName = computed(() => merchantStore.stores.value.find(store => store.id === merchantStore.selectedId.value)?.name ?? '')
const number = (value: number) => value.toLocaleString(locale.value, { maximumFractionDigits: 0 })
const money = (value: number) => new Intl.NumberFormat(locale.value, { style: 'currency', currency: 'CNY', currencyDisplay: 'narrowSymbol' }).format(value)
const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
const dirty = computed(() => from.value !== dateInput(new Date(period.value.startAt)) || to.value !== dateInput(new Date(Date.parse(period.value.endAt) - 1)))
const tasks = computed(() => [
  { key: 'openAlerts' as const, route: { path: '/warehouse', query: { view: 'alerts', alertStatus: 'OPEN' } } },
  { key: 'acknowledgedAlerts' as const, route: { path: '/warehouse', query: { view: 'alerts', alertStatus: 'ACKNOWLEDGED' } } },
  { key: 'outOfStockMaterials' as const, route: { path: '/warehouse', query: { stockStatus: 'OUT' } } },
  { key: 'lowStockMaterials' as const, route: { path: '/warehouse', query: { stockStatus: 'LOW' } } },
  { key: 'pendingFulfillmentOrders' as const, route: '/orders' }, { key: 'expiredStockHoldOrders' as const, route: { path: '/warehouse', query: { view: 'holds' } } },
])
let sequence = 0
async function load() {
  const current = ++sequence; loading.value = true; error.value = undefined
  try { const data = await getMerchantDashboard(period.value); if (current === sequence) result.value = data }
  catch (value) { if (current === sequence) error.value = value instanceof Error && value.message === 'dashboard.tooLarge' ? 'tooLarge' : 'failure' }
  finally { if (current === sequence) loading.value = false }
}
async function apply() {
  try { const next = periodFromDates(from.value, to.value); if (next.startAt === period.value.startAt && next.endAt === period.value.endAt) await load(); else await router.push({ query: next }); filtersOpen.value = false }
  catch { error.value = 'invalid' }
}
function preset(days: number) { const next = dashboardPeriodPreset(days); from.value = dateInput(new Date(next.startAt)); to.value = dateInput(new Date(Date.parse(next.endAt) - 1)); void apply() }
function exportSnapshot() {
  if (!result.value || dirty.value || loading.value || error.value) return
  const data = result.value
  const rows: (string | number)[][] = [[t('store'), storeName.value, data.storeId], [t('period'), data.startAt, data.endAt], [t('timeZone'), timeZone], [t('generated'), data.generatedAt], [t('source'), t('cohortHint')], [t('source'), t('moneyHint')], [t('snapshot'), t('total'), data.orders.total, t('paid'), data.orders.paid, t('paidAmount'), data.orders.paidAmount, data.currency], [t('status'), t('orders')]]
  for (const row of data.statuses) rows.push([t(row.status), row.count])
  rows.push([t('byType'), t('orders'), t('paid'), t('paidAmount')]); for (const row of data.orderTypes) rows.push([t(row.type), row.orders, row.paidOrders, row.paidAmount])
  rows.push([t('top')], [t('product'), t('variant'), t('quantity'), t('orderCount')]); for (const row of data.topItems) rows.push([row.productName, row.skuName ?? '—', row.quantity, row.orderCount])
  rows.push([t('scope'), t('current')]); for (const task of tasks.value) rows.push([t(task.key), data.operations[task.key]])
  downloadCsv(`business-summary-${new Date().toISOString().slice(0, 10)}.csv`, rows)
}
watch(() => [route.query.startAt, route.query.endAt], () => {
  period.value = parseDashboardPeriod(route.query); from.value = dateInput(new Date(period.value.startAt)); to.value = dateInput(new Date(Date.parse(period.value.endAt) - 1))
  if (route.query.startAt !== period.value.startAt || route.query.endAt !== period.value.endAt) { void router.replace({ query: period.value }); return }
  void load()
}, { immediate: true })
onBeforeUnmount(() => { sequence++ })
</script>
<template>
  <section class="grid min-w-0 gap-5" :lang="locale">
    <FilterToggle v-model="filtersOpen" controls="dashboard-filters" class="justify-self-start sm:hidden">{{ t('filters') }}</FilterToggle>
    <form id="dashboard-filters" :data-filter-open="filtersOpen" class="dashboard-filters flex flex-wrap items-end gap-3 border bg-card p-4" @submit.prevent="apply"><MerchantDatePicker :label="t('from')" v-model="from" required /><MerchantDatePicker :label="t('to')" v-model="to" :min="from" required /><Button type="submit" variant="outline" :disabled="loading">{{ t('apply') }}</Button><div class="flex gap-1"><Button v-for="choice in [{ days: 1, key: 'today' as const }, { days: 7, key: 'week' as const }, { days: 30, key: 'month' as const }]" :key="choice.days" type="button" variant="ghost" :disabled="loading" @click="preset(choice.days)">{{ t(choice.key) }}</Button></div><DataActionButton action="export" :label="t('export')" :disabled="loading || dirty || !!error" class="sm:ml-auto" @click="exportSnapshot" /></form>
    <p v-if="dirty" role="status" class="text-sm text-amber-800">{{ t('dirty') }}</p>
    <p v-if="loading" role="status" class="p-8 text-center text-muted-foreground">{{ t('loading') }}</p>
    <div v-else-if="error" role="alert" class="border bg-card p-6 text-sm"><p>{{ t(error) }}</p><DataActionButton action="refresh" :label="t('refresh')" class="mt-3" @click="load" /></div>
    <template v-else-if="result">
      <dl class="grid grid-cols-2 gap-3 lg:grid-cols-4"><div v-for="metric in [{ key: 'paidAmount' as const, value: money(result.orders.paidAmount) }, { key: 'paid' as const, value: number(result.orders.paid) }, { key: 'total' as const, value: number(result.orders.total) }, { key: 'pending' as const, value: number(result.orders.pendingPayment) }]" :key="metric.key" class="border bg-card p-4"><dt class="text-sm text-muted-foreground">{{ t(metric.key) }}</dt><dd class="mt-3 break-words font-semibold tabular-nums" :class="metric.key === 'paidAmount' ? 'text-xl sm:text-2xl' : 'text-2xl'">{{ metric.value }}</dd></div></dl>
      <Card class="gap-0 p-4"><h2 class="font-semibold">{{ t('operations') }}</h2><div class="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-3"><RouterLink v-for="task in tasks" :key="task.key" :to="task.route" class="flex min-w-0 items-center justify-between gap-3 border px-3 py-3 text-sm hover:bg-muted"><span>{{ t(task.key) }}</span><strong class="shrink-0 tabular-nums" :class="{ 'text-amber-800': result.operations[task.key] > 0 }">{{ number(result.operations[task.key]) }}</strong></RouterLink></div></Card>
      <div class="grid min-w-0 gap-5 xl:grid-cols-2"><Card class="min-w-0 gap-0 p-0"><h2 class="border-b p-4 font-semibold">{{ t('byType') }}</h2><Table framed container-class="mx-4 mt-4" tabindex="0" class="border-collapse text-start"><thead><tr><th>{{ t('byType') }}</th><th>{{ t('orders') }}</th><th>{{ t('paid') }}</th><th>{{ t('paidAmount') }}</th></tr></thead><tbody><tr v-for="row in result.orderTypes" :key="row.type"><th scope="row">{{ t(row.type) }}</th><td>{{ number(row.orders) }}</td><td>{{ number(row.paidOrders) }}</td><td>{{ money(row.paidAmount) }}</td></tr></tbody></Table></Card><Card class="min-w-0 gap-0 p-0"><h2 class="border-b p-4 font-semibold">{{ t('status') }}</h2><div class="grid grid-cols-2 gap-x-6 gap-y-3 p-4"><div v-for="row in result.statuses.filter(row => row.status !== 'DELETED')" :key="row.status" class="flex justify-between gap-2 text-sm"><span class="text-muted-foreground">{{ t(row.status) }}</span><strong class="tabular-nums">{{ number(row.count) }}</strong></div></div></Card></div>
      <Card class="min-w-0 gap-0 p-0"><h2 class="border-b p-4 font-semibold">{{ t('top') }}</h2><p v-if="!result.topItems.length" class="p-8 text-center text-sm text-muted-foreground">{{ t('noSales') }}</p><Table framed container-class="mx-4 mt-4" v-else tabindex="0" class="border-collapse text-start"><thead><tr><th>{{ t('product') }}</th><th>{{ t('quantity') }}</th><th>{{ t('orderCount') }}</th></tr></thead><tbody><tr v-for="(row, index) in result.topItems" :key="index"><th scope="row">{{ row.productName }}<span class="mt-1 block text-xs font-normal text-muted-foreground">{{ row.skuName ?? '—' }}</span></th><td>{{ number(row.quantity) }}</td><td>{{ number(row.orderCount) }}</td></tr></tbody></Table></Card>
    </template>
  </section>
</template>
<style scoped>
label { display: grid; gap: .375rem; font-size: .75rem; color: var(--ld-text-muted); }
tbody th { font-weight: 500; } td { text-align: right; font-variant-numeric: tabular-nums; }
</style>
