<script setup lang="ts">
import FilterToggle from '@/components/FilterToggle.vue'
import MerchantDatePicker from '@/components/MerchantDatePicker.vue'
import DataActionButton from '@/components/DataActionButton.vue'
import TablePagination from '@/components/table/TablePagination.vue'
import TableAction from '@/components/table/TableAction.vue'
import { EyeIcon, Pencil } from '@lingdian/icons/web'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { PurchaseDeliveryFilter, PurchaseRecord, SupplierRecord, ReplenishmentRow } from '@lingdian/contracts'
import { Button } from '@lingdian/console-ui/button'
import { Input } from '@lingdian/console-ui/input'
import { SelectField } from '@lingdian/console-ui/select'
import { Table } from '@lingdian/console-ui/table'
import { useWarehouseViewLock } from '@/config/warehouse-view-lock'
import { purchaseList, supplierList } from '@/services/purchasing'
import { downloadCsv } from '../report'
import { dateInput } from '../activity-state'
import ReceiptReport from './ReceiptReport.vue'
import Replenishment from './Replenishment.vue'
import SupplierEditor from './SupplierEditor.vue'
import CreatePurchase from './CreatePurchase.vue'
import PurchaseDetail from './PurchaseDetail.vue'
import { usePurchasingLocale, type Key } from './locale'
import { materialId } from './replenishment-state'
import { editedCutoff, isCanonicalList, listTarget, parseListState, type PurchasingListState } from './list-state'
const props = defineProps<{ storeId: string; storeName: string }>(),
  { t, date, money, number } = usePurchasingLocale(),
  route = useRoute(),
  router = useRouter()
const now = new Date(),
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
const filtersOpen = ref(false)
const view = computed(() =>
  ['suppliers', 'report', 'replenishment'].includes(String(route.query.purchaseView))
    ? String(route.query.purchaseView)
    : 'orders',
)
const revision = ref(0),
  seedItem = ref<ReplenishmentRow>()
const keyword = ref(''),
  status = ref<PurchasingListState['status']>('ACTIVE'),
  delivery = ref<PurchaseDeliveryFilter>('ALL'),
  before = ref(''),
  total = ref(0),
  orders = ref<PurchaseRecord[]>([]),
  suppliers = ref<SupplierRecord[]>([]),
  loading = ref(false),
  failed = ref(false),
  newOrder = ref(false),
  supplierOpen = ref(false),
  selectedSupplier = ref<SupplierRecord>(),
  saved = ref(false),
  filterError = ref(false)
const id = computed(() => (typeof route.query.purchaseId === 'string' ? route.query.purchaseId : '')),
  pendingItemId = computed(() => materialId(route.query.pendingItemId)),
  listState = computed(() => parseListState(route.query, view.value === 'suppliers', !!pendingItemId.value, now)),
  page = computed(() => listState.value.page),
  applied = computed(() => listState.value.keyword),
  pendingMaterial = computed(() =>
    orders.value.flatMap((order) => order.lines).find((line) => line.itemId === pendingItemId.value),
  ),
  pageCount = computed(() => Math.max(1, Math.ceil(total.value / (listState.value.pageSize ?? 20)))),
  dirty = computed(
    () =>
      keyword.value.trim() !== applied.value ||
      (view.value === 'orders' &&
        (status.value !== listState.value.status ||
          delivery.value !== listState.value.delivery ||
          (delivery.value === 'BEFORE' && before.value !== dateInput(new Date(listState.value.expectedBefore))))),
  )
useWarehouseViewLock(() => loading.value || dirty.value)

const statusLabel = (value: PurchasingListState['status']) =>
  t(value === 'ACTIVE' ? 'active' : value === 'ALL' ? 'all' : value)
const deliveryKey = (value: PurchaseDeliveryFilter): Key =>
  value === 'BEFORE' ? 'beforeDelivery' : value === 'UNDATED' ? 'undatedDelivery' : 'allDelivery'
function outstanding(order: PurchaseRecord) {
  const line = order.lines.find((line) => line.itemId === pendingItemId.value)
  return line
    ? `${number((Math.round(line.quantity * 1000) - Math.round(line.receivedQuantity * 1000)) / 1000)} ${line.unit}`
    : '—'
}
let sequence = 0,
  disposed = false
function navigate(next: PurchasingListState, replace = false) {
  const target = { query: listTarget(route.query, next, view.value === 'suppliers') }
  return replace ? router.replace(target) : router.push(target)
}
async function load() {
  const current = ++sequence,
    state = listState.value,
    isOrders = view.value === 'orders'
  loading.value = true
  failed.value = false
  try {
    const result = isOrders
      ? await purchaseList(props.storeId, state.page, state.keyword, state.status, pendingItemId.value, {
          delivery: state.delivery,
          ...(state.delivery === 'BEFORE' ? { expectedBefore: state.expectedBefore } : {}),
        }, state.pageSize)
      : await supplierList(props.storeId, state.page, state.keyword, false, state.pageSize)
    if (current !== sequence) return
    const last = Math.max(1, Math.ceil(result.total / (state.pageSize ?? 20)))
    if (state.page > last) {
      await navigate({ ...state, page: last }, true)
      return
    }
    if (isOrders) orders.value = result.items as PurchaseRecord[]
    else suppliers.value = result.items as SupplierRecord[]
    total.value = result.total
  } catch {
    if (current === sequence) failed.value = true
  } finally {
    if (current === sequence) loading.value = false
  }
}
watch(
  [() => props.storeId, () => view.value, () => JSON.stringify(listState.value), () => pendingItemId.value],
  async () => {
    const current = ++sequence
    filterError.value = false
    saved.value = false
    const state = listState.value
    keyword.value = state.keyword
    status.value = state.status
    delivery.value = state.delivery
    before.value = dateInput(new Date(state.expectedBefore))
    if (view.value !== 'orders' && view.value !== 'suppliers') {
      loading.value = false
      return
    }
    if (!isCanonicalList(route.query, state, view.value === 'suppliers'))
      await router.replace({ query: listTarget(route.query, state, view.value === 'suppliers') })
    if (current === sequence && !disposed && props.storeId) await load()
  },
  { immediate: true },
)
watch(
  () => props.storeId,
  () => {
    newOrder.value = false
    supplierOpen.value = false
    orders.value = []
    suppliers.value = []
  },
)
watch(delivery, (value) => {
  if (value !== 'ALL') status.value = 'ACTIVE'
})
function showPending(itemId: string) {
  void router.push({
    query: {
      ...listTarget(route.query, parseListState({})),
      purchaseView: undefined,
      purchaseId: undefined,
      pendingItemId: itemId,
    },
  })
}
function backToPlan() {
  void router.push({
    query: { ...route.query, purchaseView: 'replenishment', purchaseId: undefined, pendingItemId: undefined },
  })
}
function go(value: number) {
  void navigate({ ...listState.value, page: value })
}
async function search() {
  filterError.value = false
  try {
    const next = {
      ...listState.value,
      keyword: keyword.value.trim(),
      status: status.value,
      delivery: delivery.value,
      page: 1,
      expectedBefore:
        delivery.value === 'BEFORE' ? editedCutoff(listState.value, before.value) : listState.value.expectedBefore,
    }
    if (JSON.stringify(next) === JSON.stringify(listState.value)) await load()
    else await navigate(next)
  } catch {
    filterError.value = true
  }
}
function resetFilters() {
  const state = { ...parseListState({}, view.value === 'suppliers', !!pendingItemId.value), pageSize: listState.value.pageSize }
  keyword.value = ''
  status.value = 'ACTIVE'
  delivery.value = 'ALL'
  before.value = dateInput(new Date(state.expectedBefore))
  filterError.value = false
  if (isCanonicalList(route.query, state, view.value === 'suppliers')) void load()
  else void navigate(state)
}
function edit(record?: SupplierRecord) {
  selectedSupplier.value = record
  supplierOpen.value = true
  saved.value = false
}
function open(id: string) {
  void router.push({ query: { ...route.query, purchaseId: id || undefined } })
}
function onSaved() {
  saved.value = true
  if (view.value === 'orders' || view.value === 'suppliers') void load()
  else revision.value++
}
function fromPlan(row: ReplenishmentRow) {
  seedItem.value = row
  newOrder.value = true
}
function createOrder() {
  seedItem.value = undefined
  newOrder.value = true
}
function created(id: string) {
  onSaved()
  open(id)
}
function exportPage() {
  if (loading.value || failed.value || dirty.value || !orders.value.length) return
  const state = listState.value
  const rows: (string | number)[][] = [
    [props.storeName, props.storeId],
    [t('page'), state.page, t('records'), total.value],
    [t('exportedAt'), new Date().toISOString()],
    [t('search'), state.keyword, t('status'), statusLabel(state.status)],
    [t('deliveryFilter'), t(deliveryKey(state.delivery))],
    [t('dateTimezone'), timeZone],
  ]
  if (state.delivery === 'BEFORE') rows.push([t('exclusiveBefore'), state.expectedBefore])
  if (pendingItemId.value) rows.push([t('pendingFilter'), pendingMaterial.value?.itemName ?? '', pendingItemId.value])
  rows.push([
    t('orderNo'),
    t('supplier'),
    t('status'),
    t('orderedCost') + ' (CNY)',
    t('receivedCost') + ' (CNY)',
    t('createdAt'),
    t('expectedAt'),
    ...(pendingItemId.value ? [t('pending')] : []),
  ])
  for (const row of orders.value)
    rows.push([
      row.orderNo,
      row.supplierName,
      t(row.status),
      row.totalCostCents / 100,
      row.receivedCostCents / 100,
      row.createdAt,
      row.expectedAt ?? '',
      ...(pendingItemId.value ? [outstanding(row)] : []),
    ])
  downloadCsv(`purchases-${new Date().toISOString().slice(0, 10)}-p${state.page}.csv`, rows)
}
onBeforeUnmount(() => {
  disposed = true
  sequence++
})
</script>
<template>
  <section class="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 p-4">
    <div v-if="view === 'orders' || view === 'suppliers'" class="flex flex-wrap justify-end gap-2">
      <DataActionButton action="refresh" :label="t('refresh')" :disabled="loading" @click="load" />
      <DataActionButton
        action="export"
        :label="t('export')"
        v-if="view === 'orders'"
        :disabled="loading || failed || !orders.length || dirty"
        @click="exportPage"
      />
      <Button @click="view === 'orders' ? createOrder() : edit()">
        {{ t(view === 'orders' ? 'newOrder' : 'newSupplier') }}
      </Button>
    </div>
    <ReceiptReport
      v-if="view === 'report'"
      :key="'report' + revision"
      :store-id="storeId"
      :store-name="storeName"
      @open="open"
    />
    <Replenishment
      v-else-if="view === 'replenishment'"
      :key="'plan' + revision"
      :store-id="storeId"
      :store-name="storeName"
      @create="fromPlan"
      @pending="showPending"
    />
    <template v-else>
      <div v-if="view === 'orders' && pendingItemId" class="grid gap-2 border p-3 text-sm">
        <p class="font-medium">
          {{ t('pendingFilter')
          }}<span v-if="!loading && !failed && pendingMaterial">
            · {{ pendingMaterial.itemName }} ({{ pendingMaterial.itemCode }})</span
          >
        </p>
        <div class="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" :disabled="dirty || loading" @click="backToPlan">{{
            t('backToPlan')
          }}</Button>
          <Button
            size="sm"
            variant="ghost"
            :disabled="dirty || loading"
            @click="router.push({ query: { ...route.query, pendingItemId: undefined } })"
            >{{ t('clearFocus') }}</Button
          >
        </div>
      </div>
      <FilterToggle v-model="filtersOpen" controls="purchase-filters" class="justify-self-start sm:hidden">{{ t('filters') }}</FilterToggle>
      <form
        id="purchase-filters"
        :data-filter-open="filtersOpen"
        class="purchase-filters flex flex-wrap items-end gap-2"
        @submit.prevent="search"
      >
        <label class="grow sm:max-w-sm">
          {{ t('search') }}
          <Input v-model="keyword" type="search" maxlength="120" />
        </label>
        <label v-if="view === 'orders' && !pendingItemId">
          <span>{{ t('status') }}</span>
          <SelectField
            v-model="status"
            :aria-label="t('status')"
            :disabled="loading || delivery !== 'ALL'"
            :options="[
              { value: 'ACTIVE', label: t('active') },
              { value: 'ALL', label: t('all') },
              ...(['OPEN', 'PARTIAL', 'RECEIVED', 'CANCELLED'] as const).map((value) => ({ value, label: t(value) })),
            ]"
          />
        </label>
        <label v-if="view === 'orders'"
          >{{ t('deliveryFilter')
          }}<SelectField
            v-model="delivery"
            :aria-label="t('deliveryFilter')"
            :disabled="loading"
            :options="[
              { value: 'ALL', label: t('allDelivery') },
              { value: 'BEFORE', label: t('beforeDelivery') },
              { value: 'UNDATED', label: t('undatedDelivery') },
            ]"
          /></label
        >
        <MerchantDatePicker v-if="view === 'orders' && delivery === 'BEFORE'" :label="t('exclusiveBefore')" v-model="before" required />
        <Button type="submit" variant="outline" :disabled="loading">{{ t('find') }}</Button
        ><Button type="button" variant="ghost" :disabled="loading" @click="resetFilters">{{ t('reset') }}</Button>
      </form>
      <p v-if="filterError" role="alert" class="error">{{ t('invalidDelivery') }}</p>
      <p v-if="dirty" role="status" class="help">{{ t('dirty') }}</p>
      <p v-if="view === 'orders'" class="help break-words">
        {{ t('appliedFilters') }}: {{ statusLabel(listState.status) }} · {{ t(deliveryKey(listState.delivery))
        }}<template v-if="listState.delivery === 'BEFORE'">
          · {{ date(listState.expectedBefore) }} ({{ timeZone }}) · {{ t('cutoffHint') }}</template
        ><template v-if="applied"> · {{ applied }}</template>
      </p>
      <p v-if="saved" role="status" class="text-sm text-emerald-700">{{ t('saved') }}</p>
      <p v-if="loading" role="status" class="help py-6 text-center">{{ t('loading') }}</p>
      <div v-else-if="failed" role="alert">
        <p>{{ t('failed') }}</p>
        <DataActionButton action="refresh" :label="t('refresh')" @click="load" />
      </div>
      <p v-else-if="!total" class="help py-8 text-center">{{ t('empty') }}</p>
      <template v-else-if="view === 'orders'">
        <Table framed tabindex="0" container-class="hidden md:block" class="border-collapse text-start">
          <thead>
            <tr>
              <th>{{ t('orderNo') }}</th>
              <th>{{ t('supplier') }}</th>
              <th>{{ t('status') }}</th>
              <th>{{ t('orderedCost') }}</th>
              <th>{{ t('receivedCost') }}</th>
              <th>{{ t('createdAt') }}</th>
              <th>{{ t('expectedAt') }}</th>
              <th v-if="pendingItemId">{{ t('pending') }}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="order in orders" :key="order.id">
              <td class="font-medium">{{ order.orderNo }}</td>
              <td class="break-words">{{ order.supplierName }}</td>
              <td class="whitespace-nowrap">{{ t(order.status) }}</td>
              <td class="tabular-nums">{{ money(order.totalCostCents) }}</td>
              <td class="tabular-nums">{{ money(order.receivedCostCents) }}</td>
              <td>{{ date(order.createdAt) }}</td>
              <td>{{ date(order.expectedAt) }}</td>
              <td v-if="pendingItemId">{{ outstanding(order) }}</td>
              <td>
                <TableAction :icon="EyeIcon" :label="t('details')"
                  :disabled="dirty || loading"
                  :aria-label="`${t('details')} ${order.orderNo}`"
                  @click="open(order.id)" />
              </td>
            </tr>
          </tbody>
        </Table>
        <ul class="table-scroll grid gap-3 md:hidden">
          <li v-for="order in orders" :key="order.id" class="grid gap-3 border p-3 text-sm">
            <div class="flex justify-between gap-3">
              <strong class="min-w-0 break-words">{{ order.orderNo }}</strong>
              <span class="shrink-0">{{ t(order.status) }}</span>
            </div>
            <p class="break-words">{{ order.supplierName }}</p>
            <p v-if="pendingItemId" class="break-words">{{ t('pending') }}: {{ outstanding(order) }}</p>
            <p class="help">{{ t('expectedAt') }}: {{ date(order.expectedAt) }}</p>
            <p class="help">
              {{ t('orderedCost') }} {{ money(order.totalCostCents) }} · {{ t('receivedCost') }}
              {{ money(order.receivedCostCents) }}
            </p>
            <div class="flex items-center justify-between gap-3">
              <span class="help">{{ date(order.createdAt) }}</span>
              <TableAction :icon="EyeIcon" :label="t('details')"
                :disabled="dirty || loading"
                :aria-label="`${t('details')} ${order.orderNo}`"
                @click="open(order.id)" />
            </div>
          </li>
        </ul>
      </template>
      <ul v-else class="table-scroll grid gap-3 sm:grid-cols-2">
        <li v-for="record in suppliers" :key="record.id" class="grid gap-2 border p-3 text-sm">
          <div class="flex justify-between gap-3">
            <strong class="break-words">{{ record.name }}</strong>
            <span v-if="!record.isActive" class="help">{{ t('disabled') }}</span>
          </div>
          <p class="help break-words">{{ record.code }} · {{ record.contact }}</p>
          <p v-if="record.note" class="help break-words">{{ record.note }}</p>
          <TableAction :icon="Pencil" :label="t('edit')"
            class="justify-self-end"
            :aria-label="`${t('edit')} ${record.name}`"
            @click="edit(record)" />
        </li>
      </ul>
      <div v-if="!loading && !failed" class="flex flex-wrap items-center justify-between gap-3 border-t pt-3 text-sm">
        <span>{{ total }} {{ t('records') }}</span>
        <div class="flex gap-2">
          <TablePagination
            :page-size="listState.pageSize ?? 20"
            @update:page-size="navigate({ ...listState, page: 1, pageSize: $event })"
            :page="page"
            :pages="pageCount"
            :disabled="loading || dirty"
            @update:page="go($event)"
          />
        </div>
      </div>
    </template>
    <SupplierEditor v-model:open="supplierOpen" :store-id="storeId" :supplier="selectedSupplier" @saved="onSaved" />
    <CreatePurchase v-model:open="newOrder" :store-id="storeId" :seed-item="seedItem" @saved="created" />
    <PurchaseDetail v-if="id" :id="id" :store-id="storeId" @close="open('')" @saved="onSaved" />
  </section>
</template>
<style scoped src="./purchasing.css"></style>
<style scoped>
</style>
