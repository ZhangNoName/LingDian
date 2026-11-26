<script setup lang="ts">
import { readMerchantViewData } from '@/lib/merchant-view-data'
import FilterToggle from '@/components/FilterToggle.vue'
import MerchantDatePicker from '@/components/MerchantDatePicker.vue'
import DataActionButton from '@/components/DataActionButton.vue'
import ListToolbar from '@/components/table/ListToolbar.vue'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import type { MerchantDashboardSnapshot } from '@lingdian/contracts'
import { Button } from '@lingdian/console-ui/button'
import { Badge } from '@lingdian/console-ui/badge'
import { statusTagType } from '@/views/orders/order-presentation'
import { Card } from '@lingdian/console-ui/card'
import { Table } from '@lingdian/console-ui/table'
import { ChevronRight, ClipboardList, History, ShoppingCart, Wallet } from '@lingdian/icons/web'
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
const metrics = computed(() => {
  const orders = result.value?.orders
  if (!orders) return []
  return [
    { key: 'paidAmount', value: money(orders.paidAmount), icon: Wallet },
    { key: 'paid', value: number(orders.paid), icon: ClipboardList },
    { key: 'total', value: number(orders.total), icon: ShoppingCart },
    { key: 'pending', value: number(orders.pendingPayment), icon: History },
  ] as const
})
const statusBreakdown = computed(() => {
  const rows = result.value?.statuses.filter(({ status }) => status !== 'DELETED') ?? []
  const total = rows.reduce((sum, { count }) => sum + count, 0)
  return rows.map(row => ({ ...row, share: total ? row.count / total : 0 }))
})
const tasks = computed(() => [
  { key: 'pendingFulfillmentOrders' as const, route: '/orders' },
  { key: 'openAlerts' as const, route: { path: '/warehouse', query: { view: 'alerts', alertStatus: 'OPEN' } } },
  { key: 'acknowledgedAlerts' as const, route: { path: '/warehouse', query: { view: 'alerts', alertStatus: 'ACKNOWLEDGED' } } },
  { key: 'outOfStockMaterials' as const, route: { path: '/warehouse', query: { stockStatus: 'OUT' } } },
  { key: 'lowStockMaterials' as const, route: { path: '/warehouse', query: { stockStatus: 'LOW' } } },
  { key: 'expiredStockHoldOrders' as const, route: { path: '/warehouse', query: { view: 'holds' } } },
])
let sequence = 0
async function load(refresh = true) {
  const current = ++sequence; loading.value = true; error.value = undefined
  try {
    const range = period.value
    const data = await readMerchantViewData(['dashboard', range.startAt, range.endAt], () => getMerchantDashboard(range), refresh)
    if (current === sequence) result.value = data
  }
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
  void load(false)
}, { immediate: true })
onBeforeUnmount(() => { sequence++ })
</script>
<template>
  <section class="grid min-w-0 gap-4 lg:gap-5" :lang="locale">
    <div class="border bg-card">
      <form
        id="dashboard-filters"
        :data-filter-open="filtersOpen"
        class="flex flex-wrap items-end gap-3 px-3 py-4 sm:px-4"
        @submit.prevent="apply"
      >
        <MerchantDatePicker :label="t('from')" v-model="from" required />
        <MerchantDatePicker :label="t('to')" v-model="to" :min="from" required />
        <div class="flex flex-wrap gap-1" role="group" :aria-label="t('filters')">
          <Button
            v-for="choice in [{ days: 1, key: 'today' as const }, { days: 7, key: 'week' as const }, { days: 30, key: 'month' as const }]"
            :key="choice.days"
            type="button"
            variant="ghost"
            :disabled="loading"
            @click="preset(choice.days)"
          >{{ t(choice.key) }}</Button>
        </div>
      </form>
      <ListToolbar class="border-t px-3 py-3 sm:px-4">
        <template #left>
          <FilterToggle v-model="filtersOpen" controls="dashboard-filters" class="sm:hidden">{{ t('filters') }}</FilterToggle>
        </template>
        <DataActionButton action="export" :label="t('export')" :disabled="loading || dirty || !!error" @click="exportSnapshot" />
        <DataActionButton action="refresh" :label="t('refresh')" :disabled="loading || dirty" @click="load()" />
        <Button type="submit" form="dashboard-filters" variant="outline" :disabled="loading">{{ t('apply') }}</Button>
        <Button type="button" variant="ghost" :disabled="loading" @click="preset(7)">{{ t('reset') }}</Button>
      </ListToolbar>
    </div>
    <p v-if="dirty" role="status" class="text-sm text-status-warning-ink">{{ t('dirty') }}</p>
    <p v-if="loading" role="status" class="p-8 text-center text-muted-foreground">{{ t('loading') }}</p>
    <Card v-else-if="error" role="alert" class="items-start gap-3 p-6 text-sm">
      <p>{{ t(error) }}</p>
      <DataActionButton action="refresh" :label="t('refresh')" @click="load()" />
    </Card>
    <template v-else-if="result">
      <dl class="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <Card v-for="metric in metrics" :key="metric.key" class="min-w-0 gap-3 p-3 sm:p-4">
          <dt class="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <span class="grid size-8 shrink-0 place-items-center rounded-md bg-accent text-primary">
              <component :is="metric.icon" class="size-4" aria-hidden="true" />
            </span>
            {{ t(metric.key) }}
          </dt>
          <dd class="wrap-anywhere text-xl font-semibold tracking-tight tabular-nums sm:text-3xl" :class="metric.key === 'paidAmount' && 'text-primary'">
            {{ metric.value }}
          </dd>
        </Card>
      </dl>

      <div class="grid min-w-0 gap-4 lg:gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card class="min-w-0 gap-0 p-0">
          <h2 class="border-b px-4 py-3 font-semibold sm:px-5">{{ t('status') }}</h2>
          <dl class="grid grid-cols-2 gap-x-4 gap-y-3 p-4 sm:gap-x-8 sm:px-5">
            <div v-for="row in statusBreakdown" :key="row.status" class="relative grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 pb-2.5">
              <dt><Badge :variant="statusTagType(row.status)" class="max-w-full whitespace-normal">{{ t(row.status) }}</Badge></dt>
              <dd class="text-sm font-semibold tabular-nums">
                {{ number(row.count) }}
                <span aria-hidden="true" class="absolute inset-x-0 bottom-0 h-1 bg-muted">
                  <span class="block h-full bg-primary" :style="{ width: `${row.share * 100}%` }" />
                </span>
              </dd>
            </div>
          </dl>
        </Card>

        <Card class="min-w-0 gap-0 p-0">
          <h2 class="border-b px-4 py-3 font-semibold sm:px-5">{{ t('operations') }}</h2>
          <ul class="divide-y px-4 sm:px-5">
            <li v-for="task in tasks" :key="task.key">
              <RouterLink :to="task.route" class="flex min-h-11 items-center justify-between gap-3 px-2 py-2 text-sm hover:bg-muted hover:text-primary focus-visible:outline-2 focus-visible:-outline-offset-2">
                <span>{{ t(task.key) }}</span>
                <span class="flex shrink-0 items-center gap-2">
                  <Badge
                    v-if="result.operations[task.key] > 0"
                    :variant="task.key === 'pendingFulfillmentOrders' ? 'attention' : 'warning'"
                    class="tabular-nums"
                  >{{ number(result.operations[task.key]) }}</Badge>
                  <span v-else class="text-muted-foreground tabular-nums">{{ number(0) }}</span>
                  <ChevronRight class="size-4 text-muted-foreground" aria-hidden="true" />
                </span>
              </RouterLink>
            </li>
          </ul>
        </Card>
      </div>

      <div class="grid min-w-0 items-start gap-4 lg:gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card class="min-w-0 gap-0 p-0">
          <h2 class="border-b px-4 py-3 font-semibold sm:px-5">{{ t('top') }}</h2>
          <p v-if="!result.topItems.length" class="p-8 text-center text-sm text-muted-foreground">{{ t('noSales') }}</p>
          <Table v-else tabindex="0" :aria-label="t('top')" class="dashboard-table">
            <thead>
              <tr><th scope="col">{{ t('product') }}</th><th scope="col">{{ t('quantity') }}</th><th scope="col">{{ t('orderCount') }}</th></tr>
            </thead>
            <tbody>
              <tr v-for="(row, index) in result.topItems" :key="index">
                <th scope="row" class="font-medium">
                  {{ row.productName }}
                  <span class="mt-1 block text-xs font-normal text-muted-foreground">{{ row.skuName ?? '—' }}</span>
                </th>
                <td>{{ number(row.quantity) }}</td><td>{{ number(row.orderCount) }}</td>
              </tr>
            </tbody>
          </Table>
        </Card>

        <Card class="min-w-0 gap-0 p-0">
          <h2 class="border-b px-4 py-3 font-semibold sm:px-5">{{ t('byType') }}</h2>
          <Table tabindex="0" :aria-label="t('byType')" class="dashboard-table">
            <thead>
              <tr><th scope="col">{{ t('byType') }}</th><th scope="col">{{ t('orders') }}</th><th scope="col">{{ t('paid') }}</th><th scope="col">{{ t('paidAmount') }}</th></tr>
            </thead>
            <tbody>
              <tr v-for="row in result.orderTypes" :key="row.type">
                <th scope="row" class="font-medium">{{ t(row.type) }}</th>
                <td>{{ number(row.orders) }}</td><td>{{ number(row.paidOrders) }}</td><td>{{ money(row.paidAmount) }}</td>
              </tr>
            </tbody>
          </Table>
        </Card>
      </div>
    </template>
  </section>
</template>
<style scoped>
.dashboard-table th:not(:first-child),
.dashboard-table td {
  text-align: end;
  font-variant-numeric: tabular-nums;
}
</style>
