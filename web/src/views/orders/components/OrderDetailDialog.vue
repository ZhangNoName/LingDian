<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Button } from '@lingdian/console-ui/button'
import { Textarea } from '@lingdian/console-ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@lingdian/console-ui/dialog'
import type { OrderDetail, OrderStatus, OrderStatusAction } from '../types'
import { useOrderLocale } from '../use-order-locale'
const props = defineProps<{ open: boolean; loading: boolean; error: boolean; actionError: boolean; feedback?: string; order: OrderDetail | null; actions: OrderStatusAction[]; actionNote: string; savingStatus: OrderStatus | null; deleting: boolean; canDelete: boolean }>()
const emit = defineEmits<{ 'update:open': [open: boolean]; 'update:actionNote': [note: string]; 'change-status': [status: OrderStatus]; 'delete-order': []; retry: [] }>()
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
  <Dialog :open="open" @update:open="close"><DialogContent class="max-h-[92dvh] max-w-3xl overflow-y-auto" :close-label="t('close')" :close-disabled="busy"><DialogHeader><DialogTitle>{{ t('detailTitle') }}<span v-if="order" class="mt-1 block break-all font-mono text-sm">{{ order.order_no }}</span></DialogTitle><DialogDescription>{{ t('subtitle') }}</DialogDescription></DialogHeader>
    <p v-if="loading" role="status" class="p-6 text-center text-sm text-muted-foreground">{{ t('loading') }}</p><div v-else-if="error" role="alert" class="text-sm"><p>{{ t('detailFailed') }}</p><Button variant="outline" class="mt-3" @click="$emit('retry')">{{ t('refresh') }}</Button></div>
    <template v-else-if="order">
      <div class="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 text-sm"><div><p class="font-medium">{{ status(order.status) }}</p><p class="mt-1 text-xs text-muted-foreground">{{ type(order.order_type) }} · {{ channel(order.payment_channel) }} · {{ source(order.order_source) }}</p></div><div class="text-right"><p class="text-xs text-muted-foreground">{{ t('pickup') }}</p><strong class="font-mono text-xl">{{ order.pickup_code ?? '—' }}</strong></div></div>
      <dl class="grid grid-cols-2 gap-x-5 gap-y-3 text-sm"><dt>{{ t('customer') }}</dt><dd>{{ order.customer_name }} · {{ order.customer_mobile }}</dd><dt>{{ t('created') }}</dt><dd>{{ date(order.created_at) }}</dd><dt>{{ t('updated') }}</dt><dd>{{ date(order.updated_at) }}</dd><dt>{{ t('businessDate') }}</dt><dd>{{ order.pickup_business_date ?? t('unrecorded') }}</dd><dt>{{ t('totalAmount') }}</dt><dd>{{ money(order.total_amount) }}</dd><dt>{{ t('payable') }}</dt><dd>{{ money(order.payable_amount) }}</dd><template v-if="order.delivery_address"><dt>{{ t('delivery') }}</dt><dd>{{ order.delivery_address }}</dd></template><template v-if="order.status === 'PENDING_PAYMENT' && order.stock_expires_at"><dt>{{ t('stockDeadline') }}</dt><dd>{{ date(order.stock_expires_at) }}</dd></template><template v-if="order.remark"><dt>{{ t('remark') }}</dt><dd>{{ order.remark }}</dd></template></dl>
      <section><h3 class="mb-2 text-sm font-semibold">{{ t('items') }}</h3><ul class="divide-y rounded-md border"><li v-for="item in order.items" :key="item.id" class="grid gap-2 p-3 text-sm"><div class="flex justify-between gap-3"><div class="min-w-0 break-words"><strong class="font-medium">{{ item.product_name }}</strong><p v-if="item.sku_name" class="text-xs text-muted-foreground">{{ item.sku_name }}</p></div><span class="shrink-0">× {{ item.quantity }} · {{ money(item.subtotal) }}</span></div><p class="text-xs text-muted-foreground">{{ t('unitPrice') }} {{ money(item.unit_price) }}</p><ul v-if="item.selections.length" class="grid gap-1 text-xs text-muted-foreground"><li v-for="selection in item.selections" :key="selection.id">{{ selection.group_name }} · {{ selection.option_name }} × {{ selection.quantity }}<span v-if="selection.price_delta"> · {{ money(selection.price_delta) }}</span></li></ul><p v-if="item.remark" class="break-words text-xs">{{ item.remark }}</p></li></ul></section>
      <section><h3 class="mb-2 text-sm font-semibold">{{ t('timeline') }}</h3><p v-if="!logs.length" class="text-sm text-muted-foreground">{{ t('noLogs') }}</p><ol v-else class="grid gap-3 border-l pl-4"><li v-for="log in logs" :key="log.id" class="text-sm"><p>{{ log.from_status ? status(log.from_status) : t('initial') }} → {{ status(log.to_status) }}</p><p class="mt-1 text-xs text-muted-foreground">{{ date(log.created_at) }}<span v-if="log.operator_name"> · {{ t('operator') }}: {{ log.operator_name }}</span></p><p v-if="log.note" class="mt-1 whitespace-pre-wrap break-words text-xs text-muted-foreground">{{ log.note }}</p></li></ol></section>
      <section v-if="actions.length || canDelete" class="grid gap-3 border-t pt-4"><h3 class="text-sm font-semibold">{{ t('actions') }}</h3><label>{{ t('note') }}<Textarea :model-value="actionNote" :disabled="busy" rows="2" maxlength="191" :placeholder="t('noteHint')" @update:model-value="$emit('update:actionNote', String($event))" /></label>
        <div v-if="confirmation" class="grid gap-3 rounded-md border p-3 text-sm" role="region" :aria-label="t('confirm')"><p>{{ t(confirmationHint) }}</p><p>{{ t('currentStatus') }}: {{ status(order.status) }}<span v-if="confirmation !== 'DELETE'"> → {{ t('targetStatus') }}: {{ status(confirmation) }}</span></p><div class="flex flex-wrap justify-end gap-2"><Button variant="outline" :disabled="busy" @click="confirmation = undefined">{{ t('cancel') }}</Button><Button :disabled="busy" @click="confirm">{{ t(busy ? 'busy' : 'confirm') }}</Button></div></div>
        <div v-else class="flex flex-wrap gap-2"><Button v-for="action in actions" :key="action.value" variant="outline" :disabled="busy" @click="request(action.value)">{{ action.label }}</Button><Button v-if="canDelete" variant="outline" :disabled="busy" @click="confirmation = 'DELETE'">{{ t('delete') }}</Button></div>
      </section><p v-if="actionError" role="alert" class="text-sm text-destructive">{{ t('operationFailed') }} <Button variant="outline" size="sm" :disabled="busy" @click="$emit('retry')">{{ t('refresh') }}</Button></p><p v-if="!actions.length && !canDelete" class="text-sm text-muted-foreground">{{ t('noActions') }}</p>
    </template>
    <p v-if="feedback" role="status" class="text-sm text-emerald-700">{{ feedback }}</p>
    <Button class="justify-self-end" variant="outline" :disabled="busy" @click="close(false)">{{ t('close') }}</Button>
  </DialogContent></Dialog>
</template>
<style scoped>
label { display: grid; gap: .375rem; font-size: .75rem; color: var(--ld-text-muted); } dt { color: var(--ld-text-muted); } dd { min-width: 0; overflow-wrap: anywhere; }
</style>
