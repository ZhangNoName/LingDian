<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Button } from '@lingdian/console-ui/button'
import { Card } from '@lingdian/console-ui/card'
import { Input } from '@lingdian/console-ui/input'
import { SelectField } from '@lingdian/console-ui/select'
import { deleteMerchantOrder, getMerchantOrder, listMerchantOrders, summarizeMerchantOrders } from '@/services/orders'
import { updateMerchantOrderStatus } from '@/services/orders'
import OrderList from './components/OrderList.vue'
import OrderDetailDialog from './components/OrderDetailDialog.vue'
import OrderMetricsGrid from './components/OrderMetricsGrid.vue'
import { useOrderLocale } from './use-order-locale'
import { canDeleteOrderStatus, orderStatusActions, statusOptions, orderTypeOptions, paymentChannelOptions } from './order-presentation'
import { dateInput, orderListFingerprint, orderPeriodForDraft, orderStateQuery, parseOrderState, type OrderFilterState } from './filter-state'
import type { OrderDetail, OrderListItem, OrderStatus, OrderSummaryResponse, OrderSummaryMetric } from './types'
import type { OrderMessageKey } from './messages'
const route = useRoute(), router = useRouter(), { locale, t, status, type, channel, date, money } = useOrderLocale()
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
  return [ ['total', value?.total_count], ['pending', value?.pending_payment_count], ['paid', value?.paid_count], ['refunding', value?.refunding_count], ['refunded', value?.refunded_count], ['amount', value?.total_amount] ].map(([key, count]) => ({ label: t(key as OrderMessageKey), value: valid && typeof count === 'number' ? key === 'amount' ? money(count) : count.toLocaleString(locale.value) : '—', note: '' }))
})
const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
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
function openDetail(id: string) { if (!busy.value) void navigate({ ...state.value, orderId: id }) }
function closeDetail(open: boolean) { if (!open && !busy.value) void navigate({ ...state.value, orderId: '' }) }
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
    <div class="flex flex-wrap items-center justify-between gap-3"><p class="text-sm text-muted-foreground">{{ t('subtitle') }}</p></div>
    <OrderMetricsGrid :metrics="metrics" :more-label="t('moreSummary')" :hint="t('metricHint')" />
    <Card class="gap-0 p-0"><div class="flex flex-wrap items-center justify-between gap-3 border-b p-4"><Button class="sm:hidden" variant="outline" aria-controls="order-filters" :aria-expanded="filtersOpen" @click="filtersOpen = !filtersOpen">{{ t('filters') }}</Button><h2 class="hidden font-semibold sm:block">{{ t('filters') }}</h2><div class="flex gap-2"><Button variant="outline" :disabled="loading || dirty" @click="load">{{ t('refresh') }}</Button><Button variant="ghost" :title="t('queryLinkHint')" @click="copyLink">{{ t('copyLink') }}</Button></div></div>
      <form id="order-filters" :data-open="filtersOpen" class="order-filters flex flex-wrap items-end gap-3 p-4" @submit.prevent="apply">
        <label class="grow sm:grow-0">
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
        <label>
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
        <label>
          {{ t('from') }}
          <Input v-model="filters.from" type="date" :required="!!filters.to" />
        </label>
        <label>
          {{ t('to') }}
          <Input v-model="filters.to" type="date" :required="!!filters.from" :min="filters.from" />
        </label>
        <Button variant="outline" type="button" :disabled="loading" @click="reset">{{ t('reset') }}</Button>
        <Button type="submit" :disabled="loading">{{ t('apply') }}</Button>
      </form>
      <p class="border-t px-4 py-2 text-xs text-muted-foreground">{{ t('timeZone') }}: {{ timeZone }}<span v-if="state.startAt"> · {{ t('period') }}: {{ date(state.startAt) }} → {{ date(state.endAt) }}</span></p>
    </Card>
    <p v-if="dirty" role="status" class="text-sm text-amber-800">{{ t('dirty') }}</p><p v-if="notice" role="status" class="text-sm">{{ t(notice) }}</p>
    <div ref="listPanel" class="min-w-0">
      <Card class="min-w-0 gap-0 p-0">
        <p v-if="loading" role="status" class="p-8 text-center text-sm text-muted-foreground">{{ t('loading') }}</p><div v-else-if="error" role="alert" class="p-8 text-sm"><p>{{ t(error) }}</p><Button variant="outline" class="mt-3" @click="load">{{ t('refresh') }}</Button></div><p v-else-if="!orders.length" class="p-8 text-center text-sm text-muted-foreground">{{ t('empty') }}</p><OrderList v-else :orders="orders" @detail="openDetail" />
        <div v-if="!error" class="flex flex-wrap items-center justify-between gap-3 border-t p-4 text-sm text-muted-foreground">
          <span>{{ total.toLocaleString(locale) }} {{ t('records') }} · {{ t('page') }} {{ state.page }} / {{ pageCount }}</span>
          <label>
            {{ t('pageSize') }}
            <SelectField
              :model-value="state.pageSize"
              :aria-label="t('pageSize')"
              :disabled="loading || dirty"
              :options="[20, 50, 100].map((size) => ({ value: size, label: String(size) }))"
              @update:model-value="navigate({ ...state, page: 1, pageSize: $event })"
            />
          </label>
          <div class="flex gap-2">
            <Button size="sm" variant="outline" :disabled="loading || dirty || state.page <= 1" @click="navigate({ ...state, page: state.page - 1 })">{{ t('previous') }}</Button>
            <Button size="sm" variant="outline" :disabled="loading || dirty || state.page >= pageCount" @click="navigate({ ...state, page: state.page + 1 })">{{ t('next') }}</Button>
          </div>
        </div>
      </Card>
    </div>
    <OrderDetailDialog :open="detailOpen" :loading="detailLoading" :error="detailError" :action-error="actionError" :feedback="notice === 'saved' || notice === 'deleted' ? t(notice) : undefined" :order="activeOrder" :actions="detailActions" :can-delete="canDeleteOrderStatus(activeOrder?.status)" :action-note="actionNote" :saving-status="savingStatus" :deleting="deleting" @update:open="closeDetail" @update:action-note="actionNote = $event" @change-status="saveStatus" @delete-order="remove" @retry="loadDetail" />
  </section>
</template>
<style scoped>
label { display: grid; min-width: 0; gap: .375rem; font-size: .75rem; color: var(--ld-text-muted); } @media (max-width: 639px) { .order-filters:not([data-open="true"]) { display: none; } }
</style>
