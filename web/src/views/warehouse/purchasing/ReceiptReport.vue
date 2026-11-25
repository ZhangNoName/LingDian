<script setup lang="ts">
import FilterToggle from '@/components/FilterToggle.vue'
import ListToolbar from '@/components/table/ListToolbar.vue'
import MerchantDatePicker from '@/components/MerchantDatePicker.vue'
import DataActionButton from '@/components/DataActionButton.vue'
import TablePagination from '@/components/table/TablePagination.vue'
import { EyeIcon, Filter } from '@lingdian/icons/web'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { PurchaseReceiptReport, PurchaseReportFilter } from '@lingdian/contracts'
import { Button } from '@lingdian/console-ui/button'
import { Input } from '@lingdian/console-ui/input'
import { SelectField } from '@lingdian/console-ui/select'
import { purchaseReport } from '@/services/purchasing'
import { dateInput, periodFromDates } from '../activity-state'
import { downloadCsv } from '../report'
import { receiptState, receiptQuery } from './analysis-state'
import { usePurchasingLocale, errorKey, type Key } from './locale'
import AnalysisTable, { type AnalysisRow } from './AnalysisTable.vue'
const props = defineProps<{ storeId: string; storeName: string }>(),
  emit = defineEmits<{ open: [string] }>(),
  route = useRoute(),
  router = useRouter(),
  { t, money, date, number } = usePurchasingLocale()
const state = computed(() => receiptState(route.query)),
  report = ref<PurchaseReceiptReport>(),
  from = ref(''),
  to = ref(''),
  keyword = ref(''),
  loading = ref(true),
  error = ref<Key>(),
  pageSize = ref(20),
  page = ref(1),
  group = ref<'suppliers' | 'materials' | 'lines'>('suppliers'),
  filtersOpen = ref(false)
const dirty = computed(
    () =>
      from.value !== dateInput(new Date(state.value.startAt)) ||
      to.value !== lastDate(state.value.endAt) ||
      keyword.value.trim() !== (state.value.keyword ?? ''),
  )
function lastDate(value: string) {
  return dateInput(new Date(Date.parse(value) - 1))
}
const display = computed<AnalysisRow[]>(() => {
  const data = report.value
  if (!data) return []
  if (group.value === 'suppliers')
    return data.suppliers.map((row) => ({
      key: JSON.stringify([row.supplierId, row.supplierName, row.supplierCode]),
      title: row.supplierName,
      subtitle: `${row.supplierCode} · ${row.orderCount} ${t('distinctOrders')}`,
      quantity: number(row.receiptCount),
      value: money(row.totalCostCents),
      action: 'supplier:' + row.supplierId,
      actionLabel: t('focus'),
      actionIcon: Filter,
    }))
  if (group.value === 'materials')
    return data.materials.map((row) => ({
      key: JSON.stringify([row.itemId, row.itemName, row.itemCode, row.unit]),
      title: row.itemName,
      subtitle: `${row.itemCode} · ${row.receiptCount} ${t('totalReceipts')}`,
      quantity: `${number(row.quantity)} ${row.unit}`,
      value: money(row.totalCostCents),
      action: 'item:' + row.itemId,
      actionLabel: t('focus'),
      actionIcon: Filter,
    }))
  return data.rows.map((row) => ({
    key: row.receiptId + ':' + row.itemId,
    title: row.orderNo,
    subtitle: `${date(row.receivedAt)} · ${row.supplierName} · ${row.itemCode} ${row.itemName}`,
    quantity: `${number(row.quantity)} ${row.unit}`,
    value: money(row.costCents),
    action: 'order:' + row.orderId,
    actionLabel: t('details'),
    actionIcon: EyeIcon,
  }))
})
const visible = computed(() => display.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value)),
  pages = computed(() => Math.max(1, Math.ceil(display.value.length / pageSize.value)))
let sequence = 0
async function load() {
  const current = ++sequence
  loading.value = true
  error.value = undefined
  page.value = 1
  try {
    const result = await purchaseReport(props.storeId, state.value)
    if (current === sequence) report.value = result
  } catch (e) {
    if (current === sequence) error.value = errorKey(e) === 'saveFailed' ? 'failed' : errorKey(e)
  } finally {
    if (current === sequence) loading.value = false
  }
}
watch(
  () => [props.storeId, JSON.stringify(state.value)],
  () => {
    syncDraft(state.value)
    void load()
  },
  { immediate: true },
)
function syncDraft(applied: PurchaseReportFilter) {
  from.value = dateInput(new Date(applied.startAt))
  to.value = lastDate(applied.endAt)
  keyword.value = applied.keyword ?? ''
}
watch(group, () => {
  page.value = 1
})
async function navigate(next: PurchaseReportFilter) {
  const query = { ...route.query }
  for (const key of ['receiptStartAt', 'receiptEndAt', 'receiptKeyword', 'receiptItemId', 'receiptSupplierId'])
    delete query[key]
  await router.push({ query: { ...query, ...receiptQuery(next) } })
}
async function apply() {
  try {
    const period =
      from.value === dateInput(new Date(state.value.startAt)) && to.value === lastDate(state.value.endAt)
        ? { startAt: state.value.startAt, endAt: state.value.endAt }
        : periodFromDates(from.value, to.value)
    const next = { ...state.value, ...period, keyword: keyword.value.trim() || undefined }
    if (JSON.stringify(next) === JSON.stringify(state.value)) await load()
    else await navigate(next)
    filtersOpen.value = false
  } catch {
    error.value = 'invalidPeriod'
  }
}
function reset() {
  const defaults = receiptState({})
  syncDraft(defaults)
  if (JSON.stringify(defaults) === JSON.stringify(state.value)) void load()
  else void navigate(defaults)
  filtersOpen.value = false
}
function action(value: string) {
  if (value.startsWith('order:')) emit('open', value.slice(6))
  else {
    group.value = 'lines'
    void navigate({
      ...state.value,
      ...(value.startsWith('supplier:') ? { supplierId: value.slice(9) } : { itemId: value.slice(5) }),
    })
  }
}
function exportSnapshot() {
  const data = report.value
  if (!data || dirty.value || loading.value || error.value) return
  const rows: (string | number)[][] = [
    [props.storeName, data.storeId],
    [t('period'), data.startAt, data.endAt],
    [t('generatedAt'), data.generatedAt],
    [
      t('search'),
      state.value.keyword ?? '',
      t('supplier'),
      state.value.supplierId ?? '',
      t('material'),
      state.value.itemId ?? '',
    ],
    [t('totalCost') + ' (CNY)', data.summary.totalCostCents / 100],
    [
      t('receiptId'),
      t('orderNo'),
      t('receivedAt'),
      t('supplier'),
      t('supplier') + ' · ' + t('code'),
      t('material') + ' · ' + t('code'),
      t('material'),
      t('receivedQuantity'),
      t('unitPrice'),
      t('receivedCost') + ' (CNY)',
      t('receiptBy'),
      t('note'),
    ],
  ]
  for (const row of data.rows)
    rows.push([
      row.receiptId,
      row.orderNo,
      row.receivedAt,
      row.supplierName,
      row.supplierCode,
      row.itemCode,
      row.itemName,
      `${row.quantity} ${row.unit}`,
      row.unitPriceCents / 100,
      row.costCents / 100,
      row.actorId,
      row.note,
    ])
  downloadCsv(`receipt-report-${data.startAt.slice(0, 10)}-${data.endAt.slice(0, 10)}.csv`, rows)
}
onBeforeUnmount(() => {
  sequence++
})
</script>
<template>
  <section class="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4">
    <form
      id="receipt-filters"
      :data-filter-open="filtersOpen"
      class="analysis-filters flex flex-wrap items-end gap-3"
      @submit.prevent="apply"
    >
      <MerchantDatePicker :label="t('from')" v-model="from" required />
      <MerchantDatePicker :label="t('to')" v-model="to" required />
      <label class="grow">
        {{ t('search') }}
        <Input v-model="keyword" type="search" maxlength="120" />
      </label>
    </form>
    <ListToolbar>
      <template #left>
        <FilterToggle v-model="filtersOpen" controls="receipt-filters" class="sm:hidden">{{ t('filters') }}</FilterToggle>
      </template>
      <DataActionButton
        action="export"
        :label="t('exportSnapshot')"
        :disabled="loading || dirty || !!error || !report?.rows.length"
        @click="exportSnapshot"
      />
      <DataActionButton action="refresh" :label="t('refresh')" :disabled="loading || dirty" @click="load" />
      <Button type="submit" form="receipt-filters" variant="outline" :disabled="loading">{{ t('apply') }}</Button>
      <Button type="button" variant="ghost" :disabled="loading" @click="reset">{{ t('reset') }}</Button>
    </ListToolbar>
    <div v-if="state.supplierId || state.itemId" class="flex flex-wrap items-center gap-2 text-sm">
      <span>{{ t('filterActive') }}</span>
      <Button size="sm" variant="outline" @click="navigate({ ...state, supplierId: undefined, itemId: undefined })">
        {{ t('clearFocus') }}
      </Button>
    </div>
    <p v-if="dirty" role="status" class="text-sm text-amber-800">{{ t('dirty') }}</p>
    <p v-if="loading" role="status" class="help py-6 text-center">{{ t('loading') }}</p>
    <div v-else-if="error" role="alert">
      <p class="error">{{ t(error) }}</p>
      <DataActionButton action="refresh" :label="t('refresh')" @click="load" />
    </div>
    <template v-else-if="report && !dirty">
      <dl class="grid grid-cols-3 divide-x border">
        <div
          v-for="metric in [
            { key: 'totalCost' as const, value: money(report.summary.totalCostCents) },
            { key: 'totalReceipts' as const, value: number(report.summary.receiptCount) },
            { key: 'distinctOrders' as const, value: number(report.summary.orderCount) },
          ]"
          :key="metric.key"
          class="min-w-0 p-3"
        >
          <dt class="help">{{ t(metric.key) }}</dt>
          <dd class="mt-2 break-words text-lg font-semibold tabular-nums">{{ metric.value }}</dd>
        </div>
      </dl>
      <label class="max-w-xs">
        {{ t('summaryView') }}
        <SelectField
          v-model="group"
          :aria-label="t('summaryView')"
          :options="[
            { value: 'suppliers', label: t('supplierSummary') },
            { value: 'materials', label: t('materialSummary') },
            { value: 'lines', label: t('receiptLines') },
          ]"
        />
      </label>
      <AnalysisTable
        :rows="visible"
        :title-heading="t(group === 'suppliers' ? 'supplier' : group === 'materials' ? 'material' : 'orderNo')"
        :quantity-heading="t(group === 'suppliers' ? 'totalReceipts' : 'receivedQuantity')"
        :value-heading="t('receivedCost')"
        @action="action"
      />
      <div class="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span>{{ display.length }} {{ t('records') }}</span>
        <div class="flex gap-2">
          <TablePagination
            :page="page"
            :page-size="pageSize"
            @update:page-size="pageSize = $event; page = 1"
            :pages="pages"
            @update:page="page = $event"
          />
        </div>
      </div>
    </template>
  </section>
</template>
<style scoped src="./purchasing.css"></style>
<style scoped>
</style>
