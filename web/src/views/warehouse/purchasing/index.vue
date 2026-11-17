<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { PurchaseDeliveryFilter, PurchaseRecord, SupplierRecord, ReplenishmentRow } from '@lingdian/contracts'
import { Button } from '@/baseComponents/button'
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
  pageCount = computed(() => Math.max(1, Math.ceil(total.value / 20))),
  dirty = computed(
    () =>
      keyword.value.trim() !== applied.value ||
      (view.value === 'orders' &&
        (status.value !== listState.value.status ||
          delivery.value !== listState.value.delivery ||
          (delivery.value === 'BEFORE' && before.value !== dateInput(new Date(listState.value.expectedBefore))))),
  )
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
        })
      : await supplierList(props.storeId, state.page, state.keyword)
    if (current !== sequence) return
    const last = Math.max(1, Math.ceil(result.total / 20))
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
function switchView(next: 'orders' | 'suppliers' | 'report' | 'replenishment') {
  void router.push({
    query: {
      ...route.query,
      purchaseView: next === 'orders' ? undefined : next,
      purchaseId: undefined,
      pendingItemId: undefined,
    },
  })
  saved.value = false
}
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
  const state = parseListState({}, view.value === 'suppliers', !!pendingItemId.value, new Date())
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
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex min-w-0 max-w-full flex-nowrap gap-1 overflow-x-auto [&>button]:shrink-0">
        <Button
          :variant="view === 'orders' ? 'secondary' : 'ghost'"
          :disabled="loading || dirty"
          :aria-pressed="view === 'orders'"
          @click="switchView('orders')"
        >
          {{ t('orders') }}
        </Button>
        <Button
          :variant="view === 'suppliers' ? 'secondary' : 'ghost'"
          :disabled="loading || dirty"
          :aria-pressed="view === 'suppliers'"
          @click="switchView('suppliers')"
        >
          {{ t('suppliers') }}
        </Button>
        <Button
          :variant="view === 'report' ? 'secondary' : 'ghost'"
          :disabled="loading || dirty"
          :aria-pressed="view === 'report'"
          @click="switchView('report')"
        >
          {{ t('receiptReport') }}
        </Button>
        <Button
          :variant="view === 'replenishment' ? 'secondary' : 'ghost'"
          :disabled="loading || dirty"
          :aria-pressed="view === 'replenishment'"
          @click="switchView('replenishment')"
        >
          {{ t('replenishment') }}
        </Button>
      </div>
      <div v-if="view === 'orders' || view === 'suppliers'" class="flex flex-wrap gap-2">
        <Button variant="outline" :disabled="loading" @click="load">{{ t('refresh') }}</Button>
        <Button
          v-if="view === 'orders'"
          variant="outline"
          :disabled="loading || failed || !orders.length || dirty"
          @click="exportPage"
        >
          {{ t('export') }}
        </Button>
        <Button @click="view === 'orders' ? createOrder() : edit()">
          {{ t(view === 'orders' ? 'newOrder' : 'newSupplier') }}
        </Button>
      </div>
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
      <div v-if="view === 'orders' && pendingItemId" class="grid gap-2 rounded-md border p-3 text-sm">
        <p class="font-medium">
          {{ t('pendingFilter')
          }}<span v-if="!loading && !failed && pendingMaterial">
            · {{ pendingMaterial.itemName }} ({{ pendingMaterial.itemCode }})</span
          >
        </p>
        <details class="help">
          <summary class="cursor-pointer">{{ t('pendingScope') }}</summary>
          <p class="mt-2">{{ t('pendingFilterHint') }}</p>
        </details>
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
      <Button
        class="justify-self-start sm:hidden"
        variant="outline"
        :aria-expanded="filtersOpen"
        aria-controls="purchase-filters"
        @click="filtersOpen = !filtersOpen"
      >
        {{ t('filters') }}
      </Button>
      <form
        id="purchase-filters"
        :data-open="filtersOpen"
        class="purchase-filters flex flex-wrap items-end gap-2"
        @submit.prevent="search"
      >
        <label class="grow sm:max-w-sm">
          {{ t('search') }}
          <input v-model="keyword" type="search" maxlength="120" />
        </label>
        <label v-if="view === 'orders' && !pendingItemId">
          <span>{{ t('status') }}</span>
          <select v-model="status" :aria-label="t('status')" :disabled="loading || delivery !== 'ALL'">
            <option value="ACTIVE">{{ t('active') }}</option>
            <option value="ALL">{{ t('all') }}</option>
            <option v-for="value in ['OPEN', 'PARTIAL', 'RECEIVED', 'CANCELLED'] as const" :key="value" :value="value">
              {{ t(value) }}
            </option>
          </select>
        </label>
        <label v-if="view === 'orders'"
          >{{ t('deliveryFilter')
          }}<select v-model="delivery" :aria-label="t('deliveryFilter')" :disabled="loading">
            <option value="ALL">{{ t('allDelivery') }}</option>
            <option value="BEFORE">{{ t('beforeDelivery') }}</option>
            <option value="UNDATED">{{ t('undatedDelivery') }}</option>
          </select></label
        >
        <label v-if="view === 'orders' && delivery === 'BEFORE'"
          >{{ t('exclusiveBefore') }}<input v-model="before" type="date" required
        /></label>
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
      <details v-if="view === 'orders' && listState.delivery !== 'ALL'" class="help">
        <summary class="cursor-pointer">{{ t('deliveryRules') }}</summary>
        <template v-if="listState.delivery === 'BEFORE'"
          ><p class="mt-2 break-all">{{ listState.expectedBefore }} · {{ timeZone }}</p>
          <p class="mt-2">{{ t('cutoffExplanation') }}</p></template
        >
        <p class="mt-2">{{ t('deliveryHint') }}</p>
      </details>
      <p v-if="saved" role="status" class="text-sm text-emerald-700">{{ t('saved') }}</p>
      <p v-if="loading" role="status" class="help py-6 text-center">{{ t('loading') }}</p>
      <div v-else-if="failed" role="alert">
        <p>{{ t('failed') }}</p>
        <Button variant="outline" @click="load">{{ t('refresh') }}</Button>
      </div>
      <p v-else-if="!total" class="help py-8 text-center">{{ t('empty') }}</p>
      <template v-else-if="view === 'orders'">
        <div class="hidden overflow-x-auto md:block">
          <table>
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
                  <Button
                    variant="outline"
                    size="sm"
                    :disabled="dirty || loading"
                    :aria-label="`${t('details')} ${order.orderNo}`"
                    @click="open(order.id)"
                  >
                    {{ t('details') }}
                  </Button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <ul class="grid gap-3 md:hidden">
          <li v-for="order in orders" :key="order.id" class="grid gap-3 rounded-md border p-3 text-sm">
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
              <Button
                size="sm"
                variant="outline"
                :disabled="dirty || loading"
                :aria-label="`${t('details')} ${order.orderNo}`"
                @click="open(order.id)"
              >
                {{ t('details') }}
              </Button>
            </div>
          </li>
        </ul>
      </template>
      <ul v-else class="grid gap-3 sm:grid-cols-2">
        <li v-for="record in suppliers" :key="record.id" class="grid gap-2 rounded-md border p-3 text-sm">
          <div class="flex justify-between gap-3">
            <strong class="break-words">{{ record.name }}</strong>
            <span v-if="!record.isActive" class="help">{{ t('disabled') }}</span>
          </div>
          <p class="help break-words">{{ record.code }} · {{ record.contact }}</p>
          <p v-if="record.note" class="help break-words">{{ record.note }}</p>
          <Button
            class="justify-self-end"
            size="sm"
            variant="outline"
            :aria-label="`${t('edit')} ${record.name}`"
            @click="edit(record)"
          >
            {{ t('edit') }}
          </Button>
        </li>
      </ul>
      <div v-if="!loading && !failed" class="flex flex-wrap items-center justify-between gap-3 border-t pt-3 text-sm">
        <span>{{ total }} {{ t('records') }} · {{ t('page') }} {{ page }} / {{ pageCount }}</span>
        <div class="flex gap-2">
          <Button size="sm" variant="outline" :disabled="loading || page <= 1 || dirty" @click="go(page - 1)">
            {{ t('previous') }}
          </Button>
          <Button size="sm" variant="outline" :disabled="loading || page >= pageCount || dirty" @click="go(page + 1)">
            {{ t('next') }}
          </Button>
        </div>
      </div>
    </template>
    <p class="help">{{ t('scopeHint') }}</p>
    <SupplierEditor v-model:open="supplierOpen" :store-id="storeId" :supplier="selectedSupplier" @saved="onSaved" />
    <CreatePurchase v-model:open="newOrder" :store-id="storeId" :seed-item="seedItem" @saved="created" />
    <PurchaseDetail v-if="id" :id="id" :store-id="storeId" @close="open('')" @saved="onSaved" />
  </section>
</template>
<style scoped src="./purchasing.css"></style>
<style scoped>
@media (max-width: 639px) {
  .purchase-filters:not([data-open='true']) {
    display: none;
  }
}
</style>
