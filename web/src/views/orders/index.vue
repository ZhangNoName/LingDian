<script setup lang="ts">
import FilterToggle from '@/components/FilterToggle.vue'
import MerchantDatePicker from '@/components/MerchantDatePicker.vue'
import DataActionButton from '@/components/DataActionButton.vue'
import TablePagination from '@/components/table/TablePagination.vue'
import { extendedTablePageSizes } from '@/components/table/page-size'
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Button } from '@lingdian/console-ui/button'
import { Card } from '@lingdian/console-ui/card'
import { Input } from '@lingdian/console-ui/input'
import { SelectField } from '@lingdian/console-ui/select'
import { Filter } from '@lingdian/icons/web'
import { deleteMerchantOrder, getMerchantOrder, listMerchantOrders, summarizeMerchantOrders } from '@/services/orders'
import { updateMerchantOrderStatus } from '@/services/orders'
import OrderList from './components/OrderList.vue'
import OrderDetailDialog from './components/OrderDetailDialog.vue'
import SummaryMetrics from '@/components/SummaryMetrics.vue'
import { useOrderLocale } from './use-order-locale'
import { canDeleteOrderStatus, orderStatusActions, statusOptions, orderTypeOptions, paymentChannelOptions } from './order-presentation'
import { dateInput, orderListFingerprint, orderPeriodForDraft, orderStateQuery, parseOrderState, type OrderFilterState } from './filter-state'
import type { OrderDetail, OrderListItem, OrderStatus, OrderSummaryResponse, OrderSummaryMetric } from './types'
import type { OrderMessageKey } from './messages'
const route = useRoute(), router = useRouter(), { locale, t, status, type, channel, money } = useOrderLocale()
const state = ref(parseOrderState(route.query)), filters = reactive({ keyword: '', status: '' as OrderFilterState['status'], orderType: '' as OrderFilterState['orderType'], paymentChannel: '' as OrderFilterState['paymentChannel'], from: '', to: '' })
const listPanel = ref<HTMLElement>()
const filtersOpen = ref(false), loading = ref(true), error = ref<OrderMessageKey>(), notice = ref<OrderMessageKey>()
const orders = ref<OrderListItem[]>([]), total = ref(0), summary = ref<OrderSummaryResponse>()
const detailOpen = ref(false), detailLoading = ref(false), detailError = ref(false), activeOrder = ref<OrderDetail | null>(null), actionNote = ref(''), savingStatus = ref<OrderStatus | null>(null), deleting = ref(false), actionError = ref(false)
const busy = computed(() => !!savingStatus.value || deleting.value)
const pageCount = computed(() => Math.max(1, Math.ceil(total.value / state.value.pageSize)))
const dirty = computed(() => filters.keyword.trim() !== state.value.keyword || filters.status !== state.value.status || filters.orderType !== state.value.orderType || filters.paymentChannel !== state.value.paymentChannel || filters.from !== (state.value.startAt ? dateInput(new Date(state.value.startAt)) : '') || filters.to !== (state.value.endAt ? dateInput(new Date(Date.parse(state.value.endAt) - 1)) : ''))
const detailActions = computed(() => orderStatusActions(activeOrder.value?.status, activeOrder.value?.payment_channel, locale.value))
const metrics = computed<OrderSummaryMetric[]>(() => {
  const value = summary.value, valid = !loading.value && !error.value
  const metrics = [
    { key: 'total', count: value?.total_count, tone: 'info' },
    { key: 'pending', count: value?.pending_payment_count, tone: 'warning' },
    { key: 'paid', count: value?.paid_count, tone: 'success' },
    { key: 'refunding', count: value?.refunding_count },
    { key: 'refunded', count: value?.refunded_count },
    { key: 'amount', count: value?.total_amount },
  ] as const
  return metrics.map((metric) => ({
    label: t(metric.key),
    value: valid && typeof metric.count === 'number'
      ? metric.key === 'amount' ? money(metric.count) : metric.count.toLocaleString(locale.value)
      : '—',
    tone: 'tone' in metric ? metric.tone : undefined,
  }))
})
let listSequence = 0, detailSequence = 0, lastList = '', selectedId = '', disposed = false
async function load() {
  const current = ++listSequence; loading.value = true; error.value = undefined
  const query = { ...state.value, dateRange: [] as [] }
  try {
    const [summaryData, listData] = await Promise.all([summarizeMerchantOrders(query), listMerchantOrders(query)])
    if (current === listSequence) {
      const lastPage = Math.max(1, Math.ceil(listData.total / state.value.pageSize))
      if (state.value.page > lastPage) { await navigate({ ...state.value, page: lastPage }); return }
      summary.value = summaryData; orders.value = listData.items; total.value = listData.total
    }
  } catch (value) { if (current === listSequence) error.value = value instanceof Error && value.message === 'orders.summaryTooLarge' ? 'orders.summaryTooLarge' : 'loadFailed' }
  finally { if (current === listSequence) loading.value = false }
}
async function loadDetail() {
  if (!selectedId) return
  const current = ++detailSequence, id = selectedId; detailLoading.value = true; detailError.value = false; activeOrder.value = null; actionError.value = false
  try { const data = await getMerchantOrder(id); if (current === detailSequence) activeOrder.value = data }
  catch { if (current === detailSequence) detailError.value = true }
  finally { if (current === detailSequence) detailLoading.value = false }
}
async function navigate(next: OrderFilterState) { const paging = next.page !== state.value.page || next.pageSize !== state.value.pageSize; await router.push({ query: orderStateQuery(next) }); if (paging) { await nextTick(); listPanel.value?.scrollIntoView({ block: 'start' }) } }
async function apply() {
  try {
    const period = orderPeriodForDraft(state.value, filters.from, filters.to)
    const next = { ...state.value, keyword: filters.keyword.trim(), status: filters.status, orderType: filters.orderType, paymentChannel: filters.paymentChannel, ...period, page: 1 }
    if (orderListFingerprint(next) === orderListFingerprint(state.value)) await load(); else await navigate(next)
    filtersOpen.value = false
  } catch { error.value = 'invalidPeriod' }
}
function reset() { const next = parseOrderState({}); next.orderId = state.value.orderId; if (orderListFingerprint(next) === orderListFingerprint(state.value)) { filters.keyword = ''; filters.status = ''; filters.orderType = ''; filters.paymentChannel = ''; filters.from = ''; filters.to = ''; void load() } else void navigate(next) }
let detailTrigger: HTMLElement | undefined
function openDetail(id: string, event: MouseEvent) {
  if (busy.value) return
  detailTrigger = event.currentTarget instanceof HTMLElement ? event.currentTarget : undefined
  void navigate({ ...state.value, orderId: id })
}
function restoreDetailFocus(event: Event) {
  event.preventDefault()
  const target = detailTrigger?.isConnected && detailTrigger.getClientRects().length ? detailTrigger : listPanel.value
  detailTrigger = undefined
  target?.focus({ preventScroll: true })
}
function closeDetail(open: boolean) { if (!open && !busy.value) void navigate({ ...state.value, orderId: '' }) }
function reflectNativePayment() {
  if (activeOrder.value?.status === 'PENDING_PAYMENT' && activeOrder.value.payment_channel !== 'WECHAT') {
    activeOrder.value = { ...activeOrder.value, payment_channel: 'WECHAT' }
  }
}
function refreshAfterPayment() {
  void loadDetail()
  void load()
}
async function saveStatus(target: OrderStatus) {
  if (!activeOrder.value || busy.value || !detailActions.value.some(action => action.value === target)) return
  const id = activeOrder.value.id; savingStatus.value = target; actionError.value = false; notice.value = undefined
  try {
    const updated = await updateMerchantOrderStatus(id, target, actionNote.value.trim())
    if (disposed) return
    if (activeOrder.value?.id === id) { activeOrder.value = updated; actionNote.value = '' }
    notice.value = 'saved'; await load()
  } catch { if (!disposed) actionError.value = true }
  finally { savingStatus.value = null }
}
async function remove() {
  if (!activeOrder.value || busy.value || !canDeleteOrderStatus(activeOrder.value.status)) return
  const id = activeOrder.value.id; deleting.value = true; actionError.value = false; notice.value = undefined
  try { const updated = await deleteMerchantOrder(id); if (disposed) return; if (activeOrder.value?.id === id) activeOrder.value = updated; notice.value = 'deleted'; await load() }
  catch { if (!disposed) actionError.value = true }
  finally { deleting.value = false }
}
async function copyLink() { try { await navigator.clipboard.writeText(window.location.href); notice.value = 'copied' } catch { notice.value = 'copyFailed' } }
watch(() => route.fullPath, () => {
  const next = parseOrderState(route.query), canonical = orderStateQuery(next)
  if (JSON.stringify(Object.entries(route.query).sort()) !== JSON.stringify(Object.entries(canonical).sort())) { void router.replace({ query: canonical }); return }
  state.value = next
  const fingerprint = orderListFingerprint(next)
  if (fingerprint !== lastList) {
    lastList = fingerprint; filters.keyword = next.keyword; filters.status = next.status; filters.orderType = next.orderType; filters.paymentChannel = next.paymentChannel; filters.from = next.startAt ? dateInput(new Date(next.startAt)) : ''; filters.to = next.endAt ? dateInput(new Date(Date.parse(next.endAt) - 1)) : ''; void load()
  }
  if (next.orderId !== selectedId) { selectedId = next.orderId; detailSequence++; activeOrder.value = null; actionNote.value = ''; detailOpen.value = !!selectedId; if (selectedId) { notice.value = undefined; void loadDetail() } }
}, { immediate: true })
onBeforeUnmount(() => { disposed = true; listSequence++; detailSequence++ })
</script>
<template>
  <section class="grid min-w-0 gap-4" :lang="locale">
    <SummaryMetrics :metrics="metrics" :more-label="t('moreSummary')" desktop-columns="xl:grid-cols-6" />
    <Card class="min-w-0 gap-0 p-0">
      <div class="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <h2 class="font-semibold">{{ t('list') }}</h2>
        <div class="flex flex-wrap items-center gap-2">
          <FilterToggle v-model="filtersOpen" controls="order-filters" class="sm:hidden">
            <Filter aria-hidden="true" />{{ t('filters') }}
          </FilterToggle>
          <DataActionButton action="refresh" :label="t('refresh')" :disabled="loading || dirty" @click="load" />
          <Button variant="ghost" type="button" :title="t('queryLinkHint')" @click="copyLink">{{ t('copyLink') }}</Button>
        </div>
      </div>
      <form
        id="order-filters"
        :data-filter-open="filtersOpen"
        :aria-label="t('filters')"
        class="order-filters grid grid-cols-2 items-start gap-3 border-t px-4 py-3 sm:grid-cols-3 xl:grid-cols-[minmax(12rem,1.5fr)_repeat(5,minmax(0,1fr))]"
        @submit.prevent="apply"
      >
        <label class="col-span-2 sm:col-span-1">
          {{ t('search') }}
          <Input v-model="filters.keyword" type="search" maxlength="120" :placeholder="t('searchHint')" />
        </label>
        <label>
          {{ t('status') }}
          <SelectField
            v-model="filters.status"
            :aria-label="t('status')"
            :options="[
              { value: '', label: t('all') },
              ...statusOptions.map((option) => ({ value: option.value, label: status(option.value) })),
            ]"
          />
        </label>
        <label>
          {{ t('type') }}
          <SelectField
            v-model="filters.orderType"
            :aria-label="t('type')"
            :options="[
              { value: '', label: t('all') },
              ...orderTypeOptions.map((option) => ({ value: option.value, label: type(option.value) })),
            ]"
          />
        </label>
        <label class="col-span-2 sm:col-span-1">
          {{ t('channel') }}
          <SelectField
            v-model="filters.paymentChannel"
            :aria-label="t('channel')"
            :options="[
              { value: '', label: t('all') },
              ...paymentChannelOptions.map((option) => ({ value: option.value, label: channel(option.value) })),
            ]"
          />
        </label>
        <MerchantDatePicker class="w-full" :label="t('from')" v-model="filters.from" :required="!!filters.to" />
        <MerchantDatePicker class="w-full" :label="t('to')" v-model="filters.to" :required="!!filters.from" :min="filters.from" />
        <div class="col-span-full flex flex-wrap justify-end gap-2">
          <Button variant="outline" type="button" :disabled="loading" @click="reset">{{ t('reset') }}</Button>
          <Button type="submit" :disabled="loading">{{ t('apply') }}</Button>
        </div>
      </form>
      <p v-if="dirty" role="status" class="border-t px-4 py-3 text-sm text-status-warning-ink">{{ t('dirty') }}</p>
      <p v-if="notice" role="status" class="border-t px-4 py-3 text-sm">{{ t(notice) }}</p>
      <div ref="listPanel" tabindex="-1" class="min-w-0 border-t focus-visible:outline-2 focus-visible:-outline-offset-2">
        <p v-if="loading" role="status" class="p-8 text-center text-sm text-muted-foreground">{{ t('loading') }}</p>
        <div v-else-if="error" role="alert" class="p-8 text-sm">
          <p>{{ t(error) }}</p>
          <DataActionButton action="refresh" :label="t('refresh')" class="mt-3" @click="load" />
        </div>
        <p v-else-if="!orders.length" class="p-8 text-center text-sm text-muted-foreground">{{ t('empty') }}</p>
        <OrderList v-else :orders="orders" @detail="openDetail" />
        <div v-if="!error" class="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm text-muted-foreground">
          <span>{{ total.toLocaleString(locale) }} {{ t('records') }}</span>
          <div class="flex gap-2">
            <TablePagination
              :page-size="state.pageSize"
              @update:page-size="navigate({ ...state, page: 1, pageSize: $event })"
              :page-sizes="extendedTablePageSizes"
              :page="state.page"
              :pages="pageCount"
              :disabled="loading || dirty"
              @update:page="navigate({ ...state, page: $event })"
            />
          </div>
        </div>
      </div>
    </Card>
    <OrderDetailDialog :open="detailOpen" :loading="detailLoading" :error="detailError" :action-error="actionError" :feedback="notice === 'saved' || notice === 'deleted' ? t(notice) : undefined" :order="activeOrder" :actions="detailActions" :can-delete="canDeleteOrderStatus(activeOrder?.status)" :action-note="actionNote" :saving-status="savingStatus" :deleting="deleting" @update:open="closeDetail" @close-auto-focus="restoreDetailFocus" @update:action-note="actionNote = $event" @change-status="saveStatus" @delete-order="remove" @payment-started="reflectNativePayment" @payment-updated="refreshAfterPayment" @retry="loadDetail" />
  </section>
</template>
<style scoped>
.order-filters label {
  display: grid;
  min-width: 0;
  gap: .375rem;
  font-size: .75rem;
  color: var(--muted-foreground);
}

@media (width < 40rem) {
  .order-filters :deep([data-slot="date-picker"] input) {
    padding-inline-start: .5rem;
    font-size: .75rem;
  }
}
</style>
