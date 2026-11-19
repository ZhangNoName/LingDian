<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import type { MerchantDashboardSnapshot } from '@lingdian/contracts'
import { Button } from '@lingdian/console-ui/button'
import { Card } from '@lingdian/console-ui/card'
import { Input } from '@lingdian/console-ui/input'
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
const date = (value: string) => new Intl.DateTimeFormat(locale.value, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
const dirty = computed(() => from.value !== dateInput(new Date(period.value.startAt)) || to.value !== dateInput(new Date(Date.parse(period.value.endAt) - 1)))
const tasks = computed(() => [
  { key: 'openAlerts' as const, route: { path: '/warehouse', query: { view: 'alerts' } } }, { key: 'acknowledgedAlerts' as const, route: { path: '/warehouse', query: { view: 'alerts' } } },
  { key: 'outOfStockMaterials' as const, route: '/warehouse' }, { key: 'lowStockMaterials' as const, route: '/warehouse' },
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
    <div class="flex flex-wrap items-start justify-between gap-3"><div><p class="text-sm text-muted-foreground">{{ t('subtitle') }}</p><p class="mt-1 font-medium">{{ storeName }}</p></div></div>
    <Button variant="outline" class="justify-self-start sm:hidden" aria-controls="dashboard-filters" :aria-expanded="filtersOpen" @click="filtersOpen = !filtersOpen">{{ t('filters') }}</Button>
    <form id="dashboard-filters" :data-open="filtersOpen" class="dashboard-filters flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4" @submit.prevent="apply"><label>{{ t('from') }}<Input v-model="from" type="date" required /></label><label>{{ t('to') }}<Input v-model="to" type="date" :min="from" required /></label><Button type="submit" variant="outline" :disabled="loading">{{ t('apply') }}</Button><div class="flex gap-1"><Button v-for="choice in [{ days: 1, key: 'today' as const }, { days: 7, key: 'week' as const }, { days: 30, key: 'month' as const }]" :key="choice.days" type="button" variant="ghost" :disabled="loading" @click="preset(choice.days)">{{ t(choice.key) }}</Button></div><Button type="button" variant="outline" :disabled="loading || dirty || !!error" class="sm:ml-auto" @click="exportSnapshot">{{ t('export') }}</Button></form>
    <p v-if="dirty" role="status" class="text-sm text-amber-800">{{ t('dirty') }}</p>
    <p v-if="loading" role="status" class="p-8 text-center text-muted-foreground">{{ t('loading') }}</p>
    <div v-else-if="error" role="alert" class="rounded-lg border bg-card p-6 text-sm"><p>{{ t(error) }}</p><Button class="mt-3" variant="outline" @click="load">{{ t('refresh') }}</Button></div>
    <template v-else-if="result">
      <p class="text-xs text-muted-foreground">{{ t('period') }}: {{ date(result.startAt) }} → {{ date(result.endAt) }} · {{ t('timeZone') }}: {{ timeZone }} · {{ t('generated') }}: {{ date(result.generatedAt) }}</p>
      <dl class="grid grid-cols-2 gap-3 lg:grid-cols-4"><div v-for="metric in [{ key: 'paidAmount' as const, value: money(result.orders.paidAmount) }, { key: 'paid' as const, value: number(result.orders.paid) }, { key: 'total' as const, value: number(result.orders.total) }, { key: 'pending' as const, value: number(result.orders.pendingPayment) }]" :key="metric.key" class="rounded-lg border bg-card p-4"><dt class="text-sm text-muted-foreground">{{ t(metric.key) }}</dt><dd class="mt-3 break-words font-semibold tabular-nums" :class="metric.key === 'paidAmount' ? 'text-xl sm:text-2xl' : 'text-2xl'">{{ metric.value }}</dd></div></dl>
      <Card class="gap-0 p-4"><h2 class="font-semibold">{{ t('operations') }}</h2><p class="mt-1 text-xs text-muted-foreground">{{ t('operationsHint') }}</p><div class="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-3"><RouterLink v-for="task in tasks" :key="task.key" :to="task.route" class="flex min-w-0 items-center justify-between gap-3 rounded-md border px-3 py-3 text-sm hover:bg-muted"><span>{{ t(task.key) }}</span><strong class="shrink-0 tabular-nums" :class="{ 'text-amber-800': result.operations[task.key] > 0 }">{{ number(result.operations[task.key]) }}</strong></RouterLink></div></Card>
      <div class="grid min-w-0 gap-5 xl:grid-cols-2"><Card class="min-w-0 gap-0 p-0"><h2 class="border-b p-4 font-semibold">{{ t('byType') }}</h2><Table tabindex="0" class="border-collapse text-start"><thead><tr><th>{{ t('byType') }}</th><th>{{ t('orders') }}</th><th>{{ t('paid') }}</th><th>{{ t('paidAmount') }}</th></tr></thead><tbody><tr v-for="row in result.orderTypes" :key="row.type"><th scope="row">{{ t(row.type) }}</th><td>{{ number(row.orders) }}</td><td>{{ number(row.paidOrders) }}</td><td>{{ money(row.paidAmount) }}</td></tr></tbody></Table></Card><Card class="min-w-0 gap-0 p-0"><h2 class="border-b p-4 font-semibold">{{ t('status') }}</h2><p class="px-4 pt-3 text-xs text-muted-foreground">{{ t('statusHint') }}</p><div class="grid grid-cols-2 gap-x-6 gap-y-3 p-4"><div v-for="row in result.statuses.filter(row => row.status !== 'DELETED')" :key="row.status" class="flex justify-between gap-2 text-sm"><span class="text-muted-foreground">{{ t(row.status) }}</span><strong class="tabular-nums">{{ number(row.count) }}</strong></div></div></Card></div>
      <Card class="min-w-0 gap-0 p-0"><h2 class="border-b p-4 font-semibold">{{ t('top') }}</h2><p v-if="!result.topItems.length" class="p-8 text-center text-sm text-muted-foreground">{{ t('noSales') }}</p><Table v-else tabindex="0" class="border-collapse text-start"><thead><tr><th>{{ t('product') }}</th><th>{{ t('quantity') }}</th><th>{{ t('orderCount') }}</th></tr></thead><tbody><tr v-for="(row, index) in result.topItems" :key="index"><th scope="row">{{ row.productName }}<span class="mt-1 block text-xs font-normal text-muted-foreground">{{ row.skuName ?? '—' }}</span></th><td>{{ number(row.quantity) }}</td><td>{{ number(row.orderCount) }}</td></tr></tbody></Table></Card>
      <footer class="text-xs leading-5 text-muted-foreground"><p>{{ t('cohortHint') }}</p><p>{{ t('moneyHint') }}</p><p>{{ t('stockHint') }}</p><div class="mt-3 flex flex-wrap gap-4 text-sm text-primary"><RouterLink to="/orders">{{ t('viewOrders') }}</RouterLink><RouterLink to="/warehouse">{{ t('viewStock') }}</RouterLink><RouterLink to="/warehouse?view=alerts">{{ t('viewAlerts') }}</RouterLink><RouterLink to="/warehouse?view=holds">{{ t('viewHolds') }}</RouterLink></div></footer>
    </template>
  </section>
</template>
<style scoped>
label { display: grid; gap: .375rem; font-size: .75rem; color: var(--ld-text-muted); }
@media (max-width: 639px) { .dashboard-filters:not([data-open="true"]) { display: none; } }
th, td { padding: .875rem 1rem; border-bottom: 1px solid var(--ld-border-default); white-space: nowrap; }
tbody th { font-weight: 500; } thead th { font-weight: 500; color: var(--ld-text-muted); font-size: .75rem; } td { text-align: right; font-variant-numeric: tabular-nums; }
</style>
