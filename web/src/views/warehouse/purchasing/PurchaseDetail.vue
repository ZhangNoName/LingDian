<script setup lang="ts">
import { Disclosure } from '@lingdian/console-ui/collapsible'
import DataActionButton from '@/components/DataActionButton.vue'
import TablePagination from '@/components/table/TablePagination.vue'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { PurchaseRecord, PurchaseReceiptRecord, PurchasingPage } from '@lingdian/contracts'
import { Button } from '@lingdian/console-ui/button'
import { Input } from '@lingdian/console-ui/input'
import { Textarea } from '@lingdian/console-ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@lingdian/console-ui/dialog'
import { purchaseDetail, purchaseReceipts, receivePurchase, cancelPurchase } from '@/services/purchasing'
import { errorKey, usePurchasingLocale, type Key } from './locale'
const props = defineProps<{ id: string; storeId: string }>(),
  emit = defineEmits<{ close: []; saved: [] }>()
const { t, money, date, number } = usePurchasingLocale(),
  order = ref<PurchaseRecord>(),
  receipts = ref<PurchasingPage<PurchaseReceiptRecord>>(),
  loading = ref(false),
  saving = ref(false),
  error = ref<Key>(),
  loadError = ref(false),
  mode = ref<'view' | 'receive' | 'cancel'>('view'),
  amounts = ref<Record<string, number>>({}),
  note = ref(''),
  receiptPage = ref(1),
  receiptPageSize = ref(10),
  saved = ref(false)
const actionable = computed(() => order.value && ['OPEN', 'PARTIAL'].includes(order.value.status))
let sequence = 0,
  requestId = '',
  disposed = false
watch(
  () => [props.id, props.storeId],
  () => {
    sequence++
    order.value = undefined
    receipts.value = undefined
    mode.value = 'view'
    receiptPage.value = 1
    saved.value = false
    if (props.id) void load()
  },
  { immediate: true },
)
async function load() {
  const current = ++sequence
  loading.value = true
  loadError.value = false
  error.value = undefined
  try {
    const [record, history] = await Promise.all([
      purchaseDetail(props.storeId, props.id),
      purchaseReceipts(props.storeId, props.id, receiptPage.value, receiptPageSize.value),
    ])
    if (current === sequence) {
      order.value = record
      receipts.value = history
      mode.value = 'view'
    }
  } catch {
    if (current === sequence) loadError.value = true
  } finally {
    if (current === sequence) loading.value = false
  }
}
function close(open: boolean) {
  if (!open && !saving.value) emit('close')
}
function start(next: 'receive' | 'cancel') {
  mode.value = next
  error.value = undefined
  note.value = ''
  amounts.value = {}
  requestId = crypto.randomUUID()
  saved.value = false
}
function fill() {
  for (const line of order.value?.lines ?? [])
    amounts.value[line.id] = Math.max(0, Math.round((line.quantity - line.receivedQuantity) * 1000) / 1000)
}
async function submit() {
  if (saving.value || !order.value) return
  const record = order.value,
    lines = record.lines
      .map((line) => ({ lineId: line.id, quantity: amounts.value[line.id] ?? 0 }))
      .filter((line) => line.quantity > 0)
  if (!note.value.trim() || (mode.value === 'receive' && !lines.length)) {
    error.value = 'invalid'
    return
  }
  saving.value = true
  error.value = undefined
  try {
    if (mode.value === 'cancel')
      await cancelPurchase(props.storeId, record.id, { expectedVersion: record.version, note: note.value.trim() })
    else
      await receivePurchase(props.storeId, record.id, {
        requestId,
        expectedVersion: record.version,
        note: note.value.trim(),
        lines,
      })
    if (disposed) return
    mode.value = 'view'
    saved.value = true
    emit('saved')
    await load()
  } catch (e) {
    if (!disposed) error.value = errorKey(e)
  } finally {
    saving.value = false
  }
}
async function page(value: number) {
  receiptPage.value = value
  await load()
}
onBeforeUnmount(() => {
  disposed = true
  sequence++
})
</script>
<template>
  <Dialog :open="!!id" @update:open="close">
    <DialogContent class="max-h-[92dvh] max-w-3xl overflow-y-auto" :close-label="t('close')" :close-disabled="saving">
      <DialogHeader>
        <DialogTitle>{{ order?.orderNo || t('details') }}</DialogTitle>
        <DialogDescription>
          {{ order ? `${order.supplierCode} · ${order.supplierName}` : t('loading') }}
        </DialogDescription>
      </DialogHeader>
      <p v-if="loading" role="status" class="help">{{ t('loading') }}</p>
      <div v-else-if="loadError" role="alert">
        <p>{{ t('failed') }}</p>
        <DataActionButton action="refresh" :label="t('refresh')" @click="load" />
      </div>
      <template v-else-if="order">
        <p v-if="saved" role="status" class="text-sm text-emerald-700">{{ t('saved') }}</p>
        <dl class="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt class="help">{{ t('status') }}</dt>
            <dd>{{ t(order.status) }}</dd>
          </div>
          <div>
            <dt class="help">{{ t('expectedAt') }}</dt>
            <dd>{{ date(order.expectedAt) }}</dd>
          </div>
          <div>
            <dt class="help">{{ t('orderedCost') }}</dt>
            <dd>{{ money(order.totalCostCents) }}</dd>
          </div>
          <div>
            <dt class="help">{{ t('receivedCost') }}</dt>
            <dd>{{ money(order.receivedCostCents) }}</dd>
          </div>
        </dl>
        <p v-if="order.note" class="break-words text-sm">{{ order.note }}</p>
        <div v-if="actionable && mode === 'view'" class="flex flex-wrap gap-2">
          <Button :disabled="saving" @click="start('receive')">{{ t('receive') }}</Button>
          <Button variant="outline" :disabled="saving" @click="start('cancel')">{{ t('cancelRemaining') }}</Button>
          <DataActionButton action="refresh" :label="t('refresh')" variant="ghost" @click="load" />
        </div>
        <form class="purchase-form" @submit.prevent="submit">
          <fieldset :disabled="saving" class="grid min-w-0 gap-3">
            <div v-if="mode === 'receive'" class="grid gap-3">
              <p class="help">{{ t('receiveHint') }}</p>
              <Button type="button" class="justify-self-start" variant="outline" @click="fill">
                {{ t('fillRemaining') }}
              </Button>
            </div>
            <ul class="grid gap-3">
              <li v-for="line in order.lines" :key="line.id" class="grid gap-2 border p-3 text-sm">
                <p class="break-words font-medium">{{ line.itemCode }} · {{ line.itemName }}</p>
                <p class="help">
                  {{ t('quantity') }} {{ number(line.quantity) }} {{ line.unit }} · {{ t('received') }}
                  {{ number(line.receivedQuantity) }} · {{ t(order.status==='CANCELLED'?'unreceived':'remaining') }}
                  {{ number(Math.max(0, line.quantity - line.receivedQuantity)) }} · {{ money(line.unitPriceCents) }} /
                  {{ line.unit }}
                </p>
                <label v-if="mode === 'receive' && line.quantity > line.receivedQuantity">
                  {{ t('receiptQuantity') }} ({{ line.unit }})
                  <Input
                    v-model.number="amounts[line.id]"
                    :aria-label="`${t('receiptQuantity')} ${line.itemName}`"
                    type="number"
                    min="0"
                    :max="Math.round((line.quantity - line.receivedQuantity) * 1000) / 1000"
                    step="0.001"
                  />
                </label>
              </li>
            </ul>
            <template v-if="mode !== 'view'">
              <p v-if="mode === 'cancel'" class="border border-amber-200 p-3 text-sm">
                {{ t('cancelHint') }}
              </p>
              <label>
                {{ t(mode === 'receive' ? 'receiptNote' : 'cancelReason') }}
                <Textarea v-model="note" required maxlength="240" rows="2" />
              </label>
            </template>
          </fieldset>
          <p v-if="error" role="alert" class="error">{{ t(error) }}</p>
          <div v-if="mode !== 'view'" class="flex flex-wrap justify-end gap-2 border-t pt-4">
            <Button type="button" variant="outline" :disabled="saving" @click="mode = 'view'">{{ t('cancel') }}</Button>
            <Button type="submit" :disabled="saving">
              {{ t(saving ? 'saving' : mode === 'receive' ? 'receive' : 'confirmCancel') }}
            </Button>
          </div>
        </form>
        <div v-if="order.status === 'CANCELLED'" class="grid gap-1 border p-3 text-sm">
          <p class="break-words">{{ t('cancellationReason') }}: {{ order.cancelReason }}</p>
          <p class="help">{{ t('cancelledBy') }}: {{ order.cancelledBy }} · {{ date(order.cancelledAt) }}</p>
        </div>
        <section class="grid gap-3 border-t pt-4">
          <h3 class="text-sm font-semibold">{{ t('receiptHistory') }} ({{ receipts?.total ?? 0 }})</h3>
          <p v-if="!receipts?.items.length" class="help">{{ t('noReceipt') }}</p>
          <Disclosure v-for="receipt in receipts?.items" :key="receipt.id" class="border p-3 text-sm">
            <template #label>
              {{ date(receipt.createdAt) }} · {{ money(receipt.totalCostCents) }}
            </template>
            <div class="mt-3 grid gap-2 break-words">
              <p>{{ t('receiptId') }}: {{ receipt.id }}</p>
              <p>{{ t('receiptBy') }}: {{ receipt.actorId }}</p>
              <p>{{ receipt.note }}</p>
              <p v-for="line in receipt.lines" :key="line.lineId">
                {{ line.itemName }} · {{ number(line.quantity) }} {{ line.unit }} · {{ money(line.costCents) }}
              </p>
            </div>
          </Disclosure>
          <div class="flex items-center justify-end gap-2 text-sm">
            <TablePagination
              :page="receiptPage"
              :page-size="receiptPageSize"
              @update:page-size="receiptPageSize = $event; page(1)"
              :pages="Math.ceil((receipts?.total ?? 0) / receiptPageSize)"
              :disabled="saving"
              @update:page="page($event)"
            />
          </div>
        </section>
      </template>
    </DialogContent>
  </Dialog>
</template>
<style scoped src="./purchasing.css"></style>
