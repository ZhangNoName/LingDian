<script setup lang="ts">
import DataActionButton from '@/components/DataActionButton.vue'
import { computed, ref, watch } from 'vue'
import { Badge } from '@lingdian/console-ui/badge'
import { statusTagType } from '../order-presentation'
import { Button } from '@lingdian/console-ui/button'
import { Textarea } from '@lingdian/console-ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@lingdian/console-ui/dialog'
import WechatNativePayment from './WechatNativePayment.vue'
import type { OrderDetail, OrderStatus, OrderStatusAction } from '../types'
import { useOrderLocale } from '../use-order-locale'
const props = defineProps<{ open: boolean; loading: boolean; error: boolean; actionError: boolean; feedback?: string; order: OrderDetail | null; actions: OrderStatusAction[]; actionNote: string; savingStatus: OrderStatus | null; deleting: boolean; canDelete: boolean }>()
const emit = defineEmits<{ 'update:open': [open: boolean]; 'close-auto-focus': [event: Event]; 'update:actionNote': [note: string]; 'change-status': [status: OrderStatus]; 'delete-order': []; 'payment-started': []; 'payment-updated': []; retry: [] }>()
const { t, status, type, channel, source, date, money } = useOrderLocale()
const confirmation = ref<OrderStatus | 'DELETE'>()
const busy = computed(() => !!props.savingStatus || props.deleting)
const logs = computed(() => [...(props.order?.status_logs ?? [])].reverse())
const confirmationHint = computed(() => confirmation.value === 'DELETE' ? 'deleteHint' : confirmation.value === 'PAID' ? 'confirmCash' : ['REFUNDING', 'REFUNDED'].includes(confirmation.value ?? '') ? 'confirmRefund' : 'confirmTerminate')
function close(open: boolean) { if (!busy.value) emit('update:open', open) }
function request(status: OrderStatus) { if (busy.value) return; if (['PAID','REFUNDING','REFUNDED','CANCELLED','TIMED_OUT','FAILED'].includes(status)) confirmation.value = status; else emit('change-status', status) }
function confirm() { if (busy.value || !confirmation.value) return; if (confirmation.value === 'DELETE') emit('delete-order'); else emit('change-status', confirmation.value) }
watch(() => [props.open, props.order?.id, props.order?.status], () => { confirmation.value = undefined })
</script>
<template>
  <Dialog :open="open" @update:open="close"><DialogContent class="max-h-[92dvh] max-w-3xl grid-cols-[minmax(0,1fr)] overflow-y-auto p-4 sm:p-6" :close-label="t('close')" :close-disabled="busy" :aria-describedby="undefined" @close-auto-focus="$emit('close-auto-focus', $event)"><DialogHeader><DialogTitle>{{ t('detailTitle') }}<span v-if="order" class="mt-1 block break-all font-mono text-sm">{{ order.order_no }}</span></DialogTitle></DialogHeader>
    <p v-if="loading" role="status" class="p-6 text-center text-sm text-muted-foreground">{{ t('loading') }}</p><div v-else-if="error" role="alert" class="text-sm"><p>{{ t('detailFailed') }}</p><DataActionButton action="refresh" :label="t('refresh')" class="mt-3" @click="$emit('retry')" /></div>
    <template v-else-if="order">
      <div class="grid gap-4 border bg-card p-4 text-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div class="min-w-0">
          <Badge :variant="statusTagType(order.status)">{{ status(order.status) }}</Badge>
          <p v-if="order.pickup_code" class="mt-2 flex flex-wrap items-baseline gap-x-2">
            <span class="text-xs text-muted-foreground">{{ t('pickup') }}</span>
            <strong class="wrap-anywhere font-mono text-xl font-semibold">{{ order.pickup_code }}</strong>
          </p>
          <p class="mt-2 wrap-anywhere text-xs text-muted-foreground">
            {{ type(order.order_type) }}<span v-if="order.payment_required !== false"> · {{ channel(order.payment_channel) }}</span> · {{ source(order.order_source) }}
          </p>
        </div>
        <dl class="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-4 gap-y-2 border-t pt-3 sm:border-s sm:border-t-0 sm:ps-4 sm:pt-0">
          <dt>{{ t('totalAmount') }}</dt>
          <dd class="text-end font-semibold tabular-nums">{{ money(order.total_amount) }}</dd>
          <template v-if="order.payment_required !== false">
            <dt>{{ t('payable') }}</dt>
            <dd class="text-end text-lg font-semibold text-primary tabular-nums">{{ money(order.payable_amount) }}</dd>
          </template>
        </dl>
      </div>
      <WechatNativePayment v-if="open && order.payment_required !== false && order.status === 'PENDING_PAYMENT'" :key="order.id" :order-id="order.id" :disabled="busy" @started="$emit('payment-started')" @updated="$emit('payment-updated')" />
      <section class="border bg-card">
        <h3 class="border-b px-4 py-2.5 text-sm font-semibold">{{ t('information') }}</h3>
        <dl class="grid grid-cols-[minmax(5rem,1fr)_minmax(0,2fr)] gap-x-3 gap-y-3 p-4 text-sm sm:gap-x-5">
          <dt>{{ t('customer') }}</dt><dd>{{ order.customer_name }} · {{ order.customer_mobile }}</dd>
          <dt>{{ t('created') }}</dt><dd>{{ date(order.created_at) }}</dd>
          <dt>{{ t('updated') }}</dt><dd>{{ date(order.updated_at) }}</dd>
          <dt>{{ t('businessDate') }}</dt><dd>{{ order.pickup_business_date ?? t('unrecorded') }}</dd>
          <template v-if="order.delivery_address"><dt>{{ t('delivery') }}</dt><dd>{{ order.delivery_address }}</dd></template>
          <template v-if="order.status === 'PENDING_PAYMENT' && order.stock_expires_at"><dt>{{ t('stockDeadline') }}</dt><dd>{{ date(order.stock_expires_at) }}</dd></template>
          <template v-if="order.remark"><dt>{{ t('remark') }}</dt><dd>{{ order.remark }}</dd></template>
        </dl>
      </section>
      <section><h3 class="mb-2 text-sm font-semibold">{{ t('items') }}</h3><ul class="divide-y border"><li v-for="item in order.items" :key="item.id" class="grid gap-2 p-3 text-sm"><div class="flex justify-between gap-3"><div class="min-w-0 break-words"><strong class="font-medium">{{ item.product_name }}</strong><p v-if="item.sku_name" class="text-xs text-muted-foreground">{{ item.sku_name }}</p></div><span class="shrink-0">× {{ item.quantity }} · {{ money(item.subtotal) }}</span></div><p class="text-xs text-muted-foreground">{{ t('unitPrice') }} {{ money(item.unit_price) }}</p><ul v-if="item.selections.length" class="grid gap-1 text-xs text-muted-foreground"><li v-for="selection in item.selections" :key="selection.id">{{ selection.group_name }} · {{ selection.option_name }} × {{ selection.quantity }}<span v-if="selection.price_delta"> · {{ money(selection.price_delta) }}</span></li></ul><p v-if="item.remark" class="break-words text-xs">{{ item.remark }}</p></li></ul></section>
      <section><h3 class="mb-2 text-sm font-semibold">{{ t('timeline') }}</h3><p v-if="!logs.length" class="text-sm text-muted-foreground">{{ t('noLogs') }}</p><ol v-else class="grid gap-3 border-l pl-4"><li v-for="log in logs" :key="log.id" class="text-sm"><p>{{ log.from_status ? status(log.from_status) : t('initial') }} → {{ status(log.to_status) }}</p><p class="mt-1 text-xs text-muted-foreground">{{ date(log.created_at) }}<span v-if="log.operator_name"> · {{ t('operator') }}: {{ log.operator_name }}</span></p><p v-if="log.note" class="mt-1 whitespace-pre-wrap break-words text-xs text-muted-foreground">{{ log.note }}</p></li></ol></section>
      <section v-if="actions.length || canDelete" class="grid gap-3 border-t pt-4"><h3 class="text-sm font-semibold">{{ t('actions') }}</h3><label>{{ t('note') }}<Textarea :model-value="actionNote" :disabled="busy" rows="2" maxlength="191" :placeholder="t('noteHint')" @update:model-value="$emit('update:actionNote', String($event))" /></label>
        <div v-if="confirmation" class="grid gap-3 border p-3 text-sm" role="region" :aria-label="t('confirm')"><p>{{ t(confirmationHint) }}</p><p>{{ t('currentStatus') }}: {{ status(order.status) }}<span v-if="confirmation !== 'DELETE'"> → {{ t('targetStatus') }}: {{ status(confirmation) }}</span></p><div class="flex flex-wrap justify-end gap-2"><Button variant="outline" :disabled="busy" @click="confirmation = undefined">{{ t('cancel') }}</Button><Button :disabled="busy" @click="confirm">{{ t(busy ? 'busy' : 'confirm') }}</Button></div></div>
        <div v-else class="flex flex-wrap gap-2"><Button v-for="action in actions" :key="action.value" variant="outline" :disabled="busy" @click="request(action.value)">{{ action.label }}</Button><Button v-if="canDelete" variant="outline" :disabled="busy" @click="confirmation = 'DELETE'">{{ t('delete') }}</Button></div>
      </section><p v-if="actionError" role="alert" class="text-sm text-destructive">{{ t('operationFailed') }} <DataActionButton action="refresh" :label="t('refresh')" size="icon-sm" :disabled="busy" @click="$emit('retry')" /></p>
    </template>
    <p v-if="feedback" role="status" class="text-sm text-status-success-ink">{{ feedback }}</p>
    <Button class="justify-self-end" variant="outline" :disabled="busy" @click="close(false)">{{ t('close') }}</Button>
  </DialogContent></Dialog>
</template>
<style scoped>
label { display: grid; gap: .375rem; font-size: .75rem; color: var(--ld-text-muted); } dt { color: var(--ld-text-muted); } dd { min-width: 0; overflow-wrap: anywhere; }
</style>
