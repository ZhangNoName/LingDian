<script setup lang="ts">
import { readMerchantViewData } from '@/lib/merchant-view-data'
import DataActionButton from '@/components/DataActionButton.vue'
import ListToolbar from '@/components/table/ListToolbar.vue'
import TablePagination from '@/components/table/TablePagination.vue'
import TableAction from '@/components/table/TableAction.vue'
import { EyeIcon } from '@lingdian/icons/web'
import { computed, onBeforeUnmount, onMounted, ref, watchEffect } from 'vue'
import { RouterLink } from 'vue-router'
import type { StockHoldPage, StockHoldDetail } from '@lingdian/contracts'
import { Button } from '@lingdian/console-ui/button'
import { Input } from '@lingdian/console-ui/input'
import { SearchSelectField } from '@lingdian/console-ui/select'
import { Table } from '@lingdian/console-ui/table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@lingdian/console-ui/dialog'
import { useLocale } from '@/i18n/locale'
import { getStockHold, listStockHolds, recheckStockHold } from '@/services/dashboard'
import { holdEn, holdZh, type HoldKey } from './hold-messages'
const { locale } = useLocale()
const t = (key: HoldKey) => (locale.value === 'en-US' ? holdEn : holdZh)[key]
const result = ref<StockHoldPage>(), state = ref<'EXPIRED' | 'ALL'>('EXPIRED'), keyword = ref(''), appliedKeyword = ref(''), page = ref(1), pageSize = ref(20), loading = ref(true), error = ref(false)
const selectedId = ref(''), detail = ref<StockHoldDetail>(), detailPage = ref(1), detailPageSize = ref(20), detailLoading = ref(false), detailError = ref(false), checking = ref(false), notice = ref<HoldKey>()
const expired = ref(false)
watchEffect((onCleanup) => {
  const deadline = selectedId.value && detail.value?.order.expiresAt
  const remaining = deadline ? Date.parse(deadline) - Date.now() : NaN
  expired.value = remaining <= 0
  if (remaining > 0) {
    const timer = window.setTimeout(() => { expired.value = true }, remaining)
    onCleanup(() => window.clearTimeout(timer))
  }
})
const dirty = computed(() => keyword.value.trim() !== appliedKeyword.value)
const date = (value: string | null) => value ? new Intl.DateTimeFormat(locale.value, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '—'
const number = (value: number) => value.toLocaleString(locale.value, { maximumFractionDigits: 3 })
let sequence = 0, detailSequence = 0, disposed = false
async function load(refresh = true) {
  const current = ++sequence; loading.value = true; error.value = false
  try {
    const query = [page.value, state.value, appliedKeyword.value, pageSize.value] as const
    const data = await readMerchantViewData(['stock-holds', ...query], () => listStockHolds(...query), refresh)
    if (current === sequence) result.value = data
  }
  catch { if (current === sequence) error.value = true }
  finally { if (current === sequence) loading.value = false }
}
function apply() { page.value = 1; appliedKeyword.value = keyword.value.trim(); void load() }
function reset() {
  keyword.value = ''
  changeState('EXPIRED')
}
function changeState(value: typeof state.value) {
  state.value = value
  apply()
}
async function loadDetail() {
  const current = ++detailSequence; detailLoading.value = true; detailError.value = false
  try { const data = await getStockHold(selectedId.value, detailPage.value, detailPageSize.value); if (current === detailSequence) detail.value = data }
  catch { if (current === detailSequence) detailError.value = true }
  finally { if (current === detailSequence) detailLoading.value = false }
}
function view(id: string) { selectedId.value = id; detail.value = undefined; detailPage.value = 1; notice.value = undefined; void loadDetail() }
function close(open: boolean) { if (!open && !checking.value) { selectedId.value = ''; detailSequence++ } }
async function recheck() {
  if (!selectedId.value || checking.value) return
  checking.value = true; notice.value = undefined
  try { const data = await recheckStockHold(selectedId.value); if (disposed) return; notice.value = data.outcome === 'RESOLVED' ? 'resolved' : data.outcome === 'PAYMENT_BLOCKED' ? 'blocked' : 'retry'; await loadDetail(); await load() }
  catch (value) { notice.value = value instanceof Error && value.message === 'stockHold.notExpired' ? 'notExpired' : 'unexpected' }
  finally { checking.value = false }
}
onMounted(() => void load(false))
onBeforeUnmount(() => { disposed = true; sequence++; detailSequence++ })
</script>
<template>
  <section class="min-w-0">
    <form id="inventory-hold-filters" class="flex flex-wrap items-end gap-3 px-4 pt-4" @submit.prevent="apply">
      <label>
        {{ t('search') }}
        <Input v-model="keyword" type="search" maxlength="64" />
      </label>
      <label>
        {{ t('deadline') }}
        <SearchSelectField
          :model-value="state"
          :aria-label="t('deadline')"
          :disabled="loading"
          :options="[
            { value: 'EXPIRED', label: t('expired') },
            { value: 'ALL', label: t('all') },
          ]"
          @update:model-value="changeState"
        />
      </label>
    </form>
    <ListToolbar class="border-b px-4 py-3">
      <DataActionButton action="refresh" :label="t('refresh')" :disabled="loading || dirty" @click="load()" />
      <Button type="submit" form="inventory-hold-filters" variant="outline" :disabled="loading">{{ t('searchButton') }}</Button>
      <Button type="button" variant="ghost" :disabled="loading" @click="reset">{{ t('reset') }}</Button>
    </ListToolbar>
    <p v-if="loading" role="status" class="p-8 text-center text-sm text-muted-foreground">{{ t('loading') }}</p><div v-else-if="error" role="alert" class="p-8 text-sm text-destructive"><p>{{ t('failure') }}</p><DataActionButton action="refresh" :label="t('refresh')" class="mt-3" @click="load()" /></div><p v-else-if="!result?.total" class="p-8 text-center text-sm text-muted-foreground">{{ t('empty') }}</p>
    <Table framed container-class="mx-4 mt-4" v-else tabindex="0" :aria-label="t('title')" class="border-collapse text-start"><thead><tr><th>{{ t('order') }}</th><th>{{ t('deadline') }}</th><th>{{ t('payment') }}</th><th>{{ t('materials') }}</th><th></th></tr></thead><tbody><tr v-for="row in result?.items" :key="row.orderId"><th scope="row" class="font-medium">{{ row.orderNo }}<span class="mt-1 block text-xs font-normal text-muted-foreground">{{ row.pickupCode ?? '—' }}</span></th><td>{{ date(row.expiresAt) }}</td><td>{{ t(row.paymentState) }}</td><td class="tabular-nums">{{ number(row.heldMaterialCount) }}</td><td><TableAction :icon="EyeIcon" :label="t('detail')" :aria-label="`${t('detail')} ${row.orderNo}`" @click="view(row.orderId)" /></td></tr></tbody></Table>
    <div v-if="!loading && !error" class="flex flex-wrap items-center justify-between gap-3 border-t p-4 text-sm text-muted-foreground"><span>{{ result?.total ?? 0 }} {{ t('total') }}</span><div class="flex gap-2"><TablePagination :page="page" :page-size="pageSize" @update:page-size="pageSize = $event; page = 1; load()" :pages="Math.ceil((result?.total ?? 0) / pageSize)" :disabled="dirty" @update:page="page = $event; load()" /></div></div>
    <Dialog :open="!!selectedId" @update:open="close"><DialogContent class="max-h-[90dvh] max-w-2xl overflow-y-auto" :close-label="t('close')"><DialogHeader><DialogTitle>{{ t('title') }} · {{ detail?.order.orderNo }}</DialogTitle><DialogDescription>{{ t('retryHint') }}</DialogDescription></DialogHeader>
      <p v-if="detailLoading" role="status">{{ t('loading') }}</p><div v-else-if="detailError" role="alert"><p>{{ t('failure') }}</p><DataActionButton action="refresh" :label="t('refresh')" @click="loadDetail" /></div><template v-else-if="detail"><dl class="grid grid-cols-2 gap-3 text-sm"><dt>{{ t('created') }}</dt><dd>{{ date(detail.order.createdAt) }}</dd><dt>{{ t('deadline') }}</dt><dd>{{ date(detail.order.expiresAt) }}</dd><dt>{{ t('payment') }}</dt><dd>{{ t(detail.order.paymentState) }}</dd></dl><p v-if="!detail.total" class="text-sm">{{ t('resolved') }}</p><ul v-else class="divide-y border"><li v-for="item in detail.materials" :key="item.itemId" class="flex justify-between gap-3 p-3 text-sm"><div class="min-w-0 break-words">{{ item.name }}<span class="block font-mono text-xs text-muted-foreground">{{ item.code }}</span></div><span class="shrink-0 tabular-nums">{{ number(item.quantity) }} {{ item.unit }}</span></li></ul><div v-if="detail.total" class="flex justify-end gap-2"><TablePagination :page="detailPage" :page-size="detailPageSize" @update:page-size="detailPageSize = $event; detailPage = 1; loadDetail()" :pages="Math.ceil(detail.total / detailPageSize)" :disabled="checking" @update:page="detailPage = $event; loadDetail()" /></div></template>
      <p v-if="notice" :role="notice === 'resolved' ? 'status' : 'alert'" class="text-sm">{{ t(notice) }}</p><div class="flex flex-wrap justify-end gap-2 border-t pt-4"><Button type="button" variant="outline" :disabled="checking" @click="close(false)">{{ t('close') }}</Button><Button v-if="detail" as-child variant="outline" :disabled="checking"><RouterLink :to="{ path: '/orders', query: { orderId: detail.order.orderId } }">{{ t('viewOrder') }}</RouterLink></Button><Button v-if="detail?.total && expired" :disabled="checking || detailLoading || detailError" @click="recheck">{{ t(checking ? 'checking' : 'recheck') }}</Button></div>
    </DialogContent></Dialog>
  </section>
</template>
<style scoped>
label { display: grid; min-width: 0; gap: .375rem; font-size: .75rem; color: var(--ld-text-muted); }
dt { font-size: .75rem; font-weight: 500; color: var(--ld-text-muted); } dd { overflow-wrap: anywhere; }
</style>
