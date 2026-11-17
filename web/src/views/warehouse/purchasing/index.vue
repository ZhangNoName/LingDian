<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { PurchaseRecord, SupplierRecord } from '@lingdian/contracts'
import { Button } from '@/baseComponents/button'
import { purchaseList, supplierList } from '@/services/purchasing'
import { downloadCsv } from '../report'
import SupplierEditor from './SupplierEditor.vue'
import CreatePurchase from './CreatePurchase.vue'
import PurchaseDetail from './PurchaseDetail.vue'
import { usePurchasingLocale } from './locale'
const props = defineProps<{ storeId: string; storeName: string }>(),
  { t, date, money } = usePurchasingLocale(),
  route = useRoute(),
  router = useRouter()
const filtersOpen = ref(false)
const view = ref<'orders' | 'suppliers'>('orders'),
  page = ref(1),
  keyword = ref(''),
  applied = ref(''),
  status = ref('ACTIVE'),
  total = ref(0),
  orders = ref<PurchaseRecord[]>([]),
  suppliers = ref<SupplierRecord[]>([]),
  loading = ref(false),
  failed = ref(false),
  newOrder = ref(false),
  supplierOpen = ref(false),
  selectedSupplier = ref<SupplierRecord>(),
  saved = ref(false)
const id = computed(() => (typeof route.query.purchaseId === 'string' ? route.query.purchaseId : '')),
  pageCount = computed(() => Math.max(1, Math.ceil(total.value / 20)))
let sequence = 0
async function load() {
  const current = ++sequence
  loading.value = true
  failed.value = false
  try {
    const result =
      view.value === 'orders'
        ? await purchaseList(props.storeId, page.value, applied.value, status.value)
        : await supplierList(props.storeId, page.value, applied.value)
    if (current === sequence) {
      const last = Math.max(1, Math.ceil(result.total / 20))
      if (page.value > last) {
        page.value = last
        void load()
        return
      }
      if (view.value === 'orders') orders.value = result.items as PurchaseRecord[]
      else suppliers.value = result.items as SupplierRecord[]
      total.value = result.total
    }
  } catch {
    if (current === sequence) failed.value = true
  } finally {
    if (current === sequence) loading.value = false
  }
}
watch(
  () => props.storeId,
  () => {
    sequence++
    page.value = 1
    orders.value = []
    suppliers.value = []
    newOrder.value = false
    supplierOpen.value = false
    if (props.storeId) void load()
  },
  { immediate: true },
)
function switchView(next: 'orders' | 'suppliers') {
  view.value = next
  keyword.value = ''
  applied.value = ''
  page.value = 1
  saved.value = false
  void load()
}
function go(value: number) {
  page.value = value
  void load()
}
function search() {
  applied.value = keyword.value.trim()
  page.value = 1
  void load()
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
  void load()
}
function created(id: string) {
  onSaved()
  open(id)
}
function exportPage() {
  const rows: (string | number)[][] = [
    [props.storeName, props.storeId],
    [t('page'), page.value, t('records'), total.value],
    [
      t('search'),
      applied.value,
      t('status'),
      t(status.value === 'ACTIVE' ? 'active' : status.value === 'ALL' ? 'all' : (status.value as 'OPEN')),
    ],
  ]
  rows.push([
    t('orderNo'),
    t('supplier'),
    t('status'),
    t('orderedCost') + ' (CNY)',
    t('receivedCost') + ' (CNY)',
    t('createdAt'),
  ])
  for (const row of orders.value)
    rows.push([
      row.orderNo,
      row.supplierName,
      t(row.status),
      row.totalCostCents / 100,
      row.receivedCostCents / 100,
      row.createdAt,
    ])
  downloadCsv(`purchases-${new Date().toISOString().slice(0, 10)}-p${page.value}.csv`, rows)
}
onBeforeUnmount(() => {
  sequence++
})
</script>
<template>
  <section class="grid min-w-0 gap-4 p-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex gap-1">
        <Button
          :variant="view === 'orders' ? 'secondary' : 'ghost'"
          :aria-pressed="view === 'orders'"
          @click="switchView('orders')"
        >
          {{ t('orders') }}
        </Button>
        <Button
          :variant="view === 'suppliers' ? 'secondary' : 'ghost'"
          :aria-pressed="view === 'suppliers'"
          @click="switchView('suppliers')"
        >
          {{ t('suppliers') }}
        </Button>
      </div>
      <div class="flex flex-wrap gap-2">
        <Button variant="outline" :disabled="loading" @click="load">{{ t('refresh') }}</Button>
        <Button
          v-if="view === 'orders'"
          class="hidden sm:inline-flex"
          variant="outline"
          :disabled="loading || failed || !orders.length || keyword.trim() !== applied"
          @click="exportPage"
        >
          {{ t('export') }}
        </Button>
        <Button @click="view === 'orders' ? (newOrder = true) : edit()">
          {{ t(view === 'orders' ? 'newOrder' : 'newSupplier') }}
        </Button>
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
      <label v-if="view === 'orders'">
        <span class="sr-only">{{ t('status') }}</span>
        <select v-model="status" :aria-label="t('status')" :disabled="loading" @change="go(1)">
          <option value="ACTIVE">{{ t('active') }}</option>
          <option value="ALL">{{ t('all') }}</option>
          <option v-for="value in ['OPEN', 'PARTIAL', 'RECEIVED', 'CANCELLED'] as const" :key="value" :value="value">
            {{ t(value) }}
          </option>
        </select>
      </label>
      <Button type="submit" variant="outline" :disabled="loading">{{ t('find') }}</Button>
    </form>
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
              <td>
                <Button
                  variant="outline"
                  size="sm"
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
          <p class="help">
            {{ t('orderedCost') }} {{ money(order.totalCostCents) }} · {{ t('receivedCost') }}
            {{ money(order.receivedCostCents) }}
          </p>
          <div class="flex items-center justify-between gap-3">
            <span class="help">{{ date(order.createdAt) }}</span>
            <Button
              size="sm"
              variant="outline"
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
        <Button size="sm" variant="outline" :disabled="page <= 1 || keyword.trim() !== applied" @click="go(page - 1)">
          {{ t('previous') }}
        </Button>
        <Button
          size="sm"
          variant="outline"
          :disabled="page >= pageCount || keyword.trim() !== applied"
          @click="go(page + 1)"
        >
          {{ t('next') }}
        </Button>
      </div>
    </div>
    <p class="help">{{ t('scopeHint') }}</p>
    <SupplierEditor v-model:open="supplierOpen" :store-id="storeId" :supplier="selectedSupplier" @saved="onSaved" />
    <CreatePurchase v-model:open="newOrder" :store-id="storeId" @saved="created" />
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
