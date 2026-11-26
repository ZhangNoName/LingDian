<script setup lang="ts">
import DataActionButton from '@/components/DataActionButton.vue'
import { computed, ref, watch } from 'vue'
import { Badge } from '@lingdian/console-ui/badge'
import { canCollectOrderPayment, orderStatusLogNote, statusTagType } from '../order-presentation'
import { Button } from '@lingdian/console-ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@lingdian/console-ui/card'
import { Textarea } from '@lingdian/console-ui/textarea'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@lingdian/console-ui/dialog'
import WechatNativePayment from './WechatNativePayment.vue'
import type { OrderDetail, OrderQuickAction, OrderStatus, OrderStatusAction } from '../types'
import type { OrderMessageKey } from '../messages'
import { useOrderLocale } from '../use-order-locale'
const props = defineProps<{ open: boolean; loading: boolean; error: boolean; actionError: boolean; feedback?: string; order: OrderDetail | null; actions: OrderStatusAction[]; quickAction?: OrderQuickAction; actionNote: string; savingStatus: OrderStatus | null; deleting: boolean; canDelete: boolean }>()
const emit = defineEmits<{ 'update:open': [open: boolean]; 'close-auto-focus': [event: Event]; 'update:actionNote': [note: string]; 'change-status': [status: OrderStatus]; 'delete-order': []; 'payment-started': []; 'payment-updated': []; retry: [] }>()
const { t, status, type, channel, source, customer, date, money } = useOrderLocale()
const confirmation = ref<OrderStatus | 'DELETE'>()
const busy = computed(() => !!props.savingStatus || props.deleting)
const dialogSize = computed(() => {
  if (!props.quickAction) return 'h-[58rem] max-w-3xl'
  return props.quickAction.value === 'WECHAT_PAYMENT' ? 'h-[42rem] max-w-lg' : 'h-[28rem] max-w-lg'
})
const selectedStatusAction = computed(() => props.actions.find(action => action.value === props.quickAction?.value))
const dialogTitle = computed(() => {
  if (props.quickAction?.value === 'WECHAT_PAYMENT') return t('orderActions')
  return selectedStatusAction.value?.label ?? props.quickAction?.label ?? t('detailTitle')
})
const confirmationTarget = computed(() => {
  if (props.order?.is_deleted) return
  if (props.quickAction) return selectedStatusAction.value?.value
  if (confirmation.value === 'DELETE') return props.canDelete ? 'DELETE' : undefined
  return props.actions.find(action => action.value === confirmation.value)?.value
})
const showPayment = computed(() => {
  const order = props.order
  if (!props.open || !order || order.is_deleted || !canCollectOrderPayment(order)) return false
  return !props.quickAction || props.quickAction.value === 'WECHAT_PAYMENT'
})
const quickActionUnavailable = computed(() => props.quickAction
  && (props.quickAction.value === 'WECHAT_PAYMENT' ? !showPayment.value : !confirmationTarget.value))
const logs = computed(() => (props.order?.status_logs ?? [])
  .map(log => ({ ...log, displayNote: orderStatusLogNote(log) }))
  .reverse())
const deliveryRecipient = computed(() => {
  const order = props.order
  if (order?.order_type !== 'TAKEOUT' || !order.customer_nickname?.trim()) return ''
  const recipient = order.customer_name.trim()
  return recipient !== 'Customer' && recipient !== customer(order) ? recipient : ''
})
const confirmationHints: Partial<Record<OrderStatus | 'DELETE', OrderMessageKey>> = {
  PAID: 'confirmCash',
  REFUNDING: 'confirmRefund',
  REFUNDED: 'confirmRefund',
  CANCELLED: 'confirmTerminate',
  TIMED_OUT: 'confirmTerminate',
  FAILED: 'confirmTerminate',
  DELETE: 'deleteHint',
}
const confirmationHint = computed(() => confirmationTarget.value && confirmationHints[confirmationTarget.value])
function close(open: boolean) { if (!busy.value) emit('update:open', open) }
function request(status: OrderStatus) {
  if (busy.value) return
  if (confirmationHints[status]) confirmation.value = status
  else emit('change-status', status)
}
function confirm() {
  if (busy.value || !confirmationTarget.value) return
  if (confirmationTarget.value === 'DELETE') emit('delete-order')
  else emit('change-status', confirmationTarget.value)
}
watch(() => [props.open, props.order?.id, props.order?.status], () => { confirmation.value = undefined })
</script>
<template>
  <Dialog :open="open" @update:open="close">
    <DialogContent
      class="max-h-[min(92dvh,calc(100dvh-2rem))] grid-cols-[minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0"
      :class="dialogSize"
      :close-label="t('close')"
      :close-disabled="busy"
      :aria-describedby="undefined"
      @close-auto-focus="$emit('close-auto-focus', $event)"
    >
      <DialogHeader class="border-b px-4 py-4 pe-16 text-start sm:ps-6">
        <DialogTitle>
          {{ dialogTitle }}
          <span class="mt-1 block min-h-5 break-all font-mono text-sm">{{ order?.order_no }}</span>
        </DialogTitle>
      </DialogHeader>

      <div
        class="min-h-0 overflow-y-auto overscroll-contain focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
        role="region"
        :aria-label="dialogTitle"
        tabindex="0"
      >
        <div class="grid gap-4 px-4 py-4 sm:px-6">
          <p v-if="loading" role="status" class="p-6 text-center text-sm text-muted-foreground">{{ t('loading') }}</p><div v-else-if="error" role="alert" class="text-sm"><p>{{ t('detailFailed') }}</p><DataActionButton action="refresh" :label="t('refresh')" class="mt-3" @click="$emit('retry')" /></div>
          <template v-else-if="order">
            <Card size="sm">
              <CardContent class="grid gap-4 text-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
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
              </CardContent>
            </Card>
            <WechatNativePayment v-if="showPayment" :key="order.id" :order-id="order.id" :disabled="busy" @started="$emit('payment-started')" @updated="$emit('payment-updated')" />
            <p v-if="quickActionUnavailable" role="status" class="text-sm text-muted-foreground">{{ t('actionNoLongerAvailable') }}</p>
            <template v-if="!quickAction">
              <Card size="sm">
                <CardHeader>
                  <CardTitle class="text-sm leading-5"><h3>{{ t('information') }}</h3></CardTitle>
                </CardHeader>
                <CardContent>
                  <dl class="grid grid-cols-[minmax(5rem,1fr)_minmax(0,2fr)] gap-x-3 gap-y-3 text-sm sm:gap-x-5">
                    <dt>{{ t('customer') }}</dt>
                    <dd>{{ customer(order) }}<template v-if="!deliveryRecipient"> · {{ order.customer_mobile }}</template></dd>
                    <template v-if="deliveryRecipient">
                      <dt>{{ t('deliveryRecipient') }}</dt><dd>{{ deliveryRecipient }} · {{ order.customer_mobile }}</dd>
                    </template>
                    <dt>{{ t('created') }}</dt><dd>{{ date(order.created_at) }}</dd>
                    <dt>{{ t('updated') }}</dt><dd>{{ date(order.updated_at) }}</dd>
                    <dt>{{ t('businessDate') }}</dt><dd>{{ order.pickup_business_date ?? t('unrecorded') }}</dd>
                    <template v-if="order.delivery_address"><dt>{{ t('delivery') }}</dt><dd>{{ order.delivery_address }}</dd></template>
                    <template v-if="order.status === 'PENDING_PAYMENT' && order.stock_expires_at"><dt>{{ t('stockDeadline') }}</dt><dd>{{ date(order.stock_expires_at) }}</dd></template>
                    <template v-if="order.remark"><dt>{{ t('remark') }}</dt><dd>{{ order.remark }}</dd></template>
                  </dl>
                </CardContent>
              </Card>
              <Card size="sm">
                <CardHeader>
                  <CardTitle class="text-sm leading-5"><h3>{{ t('items') }}</h3></CardTitle>
                </CardHeader>
                <CardContent>
                  <ul class="divide-y">
                    <li v-for="item in order.items" :key="item.id" class="grid gap-2 py-3 text-sm first:pt-0 last:pb-0">
                      <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                        <div class="min-w-0 flex-auto wrap-anywhere">
                          <strong class="font-medium">{{ item.product_name }}</strong>
                          <span v-if="item.sku_name" class="ms-2 text-xs text-muted-foreground">{{ item.sku_name }}</span>
                        </div>
                        <div class="ms-auto flex flex-wrap items-baseline justify-end gap-x-3 gap-y-1 tabular-nums">
                          <span class="text-xs whitespace-nowrap text-muted-foreground">{{ t('unitPrice') }} {{ money(item.unit_price) }}</span>
                          <span class="whitespace-nowrap">× {{ item.quantity }}</span>
                          <span class="font-medium whitespace-nowrap">{{ money(item.subtotal) }}</span>
                        </div>
                      </div>
                      <ul v-if="item.selections.length" class="grid gap-1 wrap-anywhere text-xs text-muted-foreground">
                        <li v-for="selection in item.selections" :key="selection.id">
                          {{ selection.group_name }} · {{ selection.option_name }} × {{ selection.quantity }}<span v-if="selection.price_delta"> · {{ money(selection.price_delta) }}</span>
                        </li>
                      </ul>
                      <p v-if="item.remark" class="wrap-anywhere text-xs">{{ item.remark }}</p>
                    </li>
                  </ul>
                </CardContent>
              </Card>
              <Card size="sm">
                <CardHeader>
                  <CardTitle class="text-sm leading-5"><h3>{{ t('timeline') }}</h3></CardTitle>
                </CardHeader>
                <CardContent>
                  <p v-if="!logs.length" class="text-sm text-muted-foreground">{{ t('noLogs') }}</p>
                  <ol v-else role="list">
                    <li
                      v-for="log in logs"
                      :key="log.id"
                      class="group/log relative grid gap-1.5 pb-3 ps-5 last:pb-0 before:absolute before:start-[3.5px] before:top-3 before:-bottom-3 before:w-px before:bg-border last:before:hidden"
                    >
                      <span aria-hidden="true" class="absolute start-0 top-2 size-2 rounded-full bg-muted-foreground/45 group-first/log:bg-primary" />
                      <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                        <p class="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                          <span class="text-muted-foreground">{{ log.from_status ? status(log.from_status) : t('initial') }} →</span>
                          <Badge :variant="statusTagType(log.to_status)">{{ status(log.to_status) }}</Badge>
                        </p>
                        <time :datetime="log.created_at" class="text-xs text-muted-foreground tabular-nums">{{ date(log.created_at) }}</time>
                      </div>
                      <p v-if="log.operator_name" class="wrap-anywhere text-xs text-muted-foreground">
                        {{ t('operator') }}: {{ log.operator_name }}
                      </p>
                      <p v-if="log.displayNote" class="whitespace-pre-wrap wrap-anywhere text-sm text-muted-foreground">{{ log.displayNote }}</p>
                    </li>
                  </ol>
                </CardContent>
              </Card>
            </template>
            <Card v-if="quickAction ? confirmationTarget : actions.length || canDelete" size="sm">
              <CardHeader v-if="!quickAction">
                <CardTitle class="text-sm leading-5"><h3>{{ t('actions') }}</h3></CardTitle>
              </CardHeader>
              <CardContent class="grid gap-3">
                <label :class="{ 'order-1': quickAction }">
                  {{ t('note') }}
                  <Textarea :model-value="actionNote" :disabled="busy" rows="2" maxlength="191" :placeholder="t('noteHint')" @update:model-value="$emit('update:actionNote', String($event))" />
                </label>
                <div v-if="confirmationTarget" class="grid gap-3 text-sm" :class="{ 'border p-3': !quickAction }" role="region" :aria-label="t('confirm')">
                  <p v-if="confirmationHint">{{ t(confirmationHint) }}</p>
                  <p>{{ t('currentStatus') }}: {{ status(order.status) }}<span v-if="confirmationTarget !== 'DELETE'"> → {{ t('targetStatus') }}: {{ status(confirmationTarget) }}</span></p>
                  <div v-if="!quickAction" class="flex flex-wrap justify-end gap-2">
                    <Button variant="outline" :disabled="busy" @click="confirmation = undefined">{{ t('cancel') }}</Button>
                    <Button :disabled="busy || actionError" @click="confirm">{{ t(busy ? 'busy' : 'confirm') }}</Button>
                  </div>
                </div>
                <div v-else class="flex flex-wrap gap-2">
                  <Button v-for="action in actions" :key="action.value" variant="outline" :disabled="busy || actionError" @click="request(action.value)">{{ action.label }}</Button>
                  <Button v-if="canDelete" variant="outline" :disabled="busy" @click="confirmation = 'DELETE'">{{ t('delete') }}</Button>
                </div>
              </CardContent>
            </Card>
            <p v-if="actionError" role="alert" class="text-sm text-destructive">{{ t('operationFailed') }} <DataActionButton action="refresh" :label="t('refresh')" size="icon-sm" :disabled="busy" @click="$emit('retry')" /></p>
          </template>
          <p v-if="feedback" role="status" class="text-sm text-status-success-ink">{{ feedback }}</p>
        </div>
      </div>

      <DialogFooter class="border-t px-4 py-3 sm:px-6" :class="{ 'flex-row! justify-end': quickAction }">
        <template v-if="quickAction && confirmationTarget && order && !loading && !error">
          <Button variant="outline" :disabled="busy" @click="close(false)">{{ t('cancel') }}</Button>
          <Button :disabled="busy || actionError" @click="confirm">{{ t(busy ? 'busy' : 'confirm') }}</Button>
        </template>
        <Button v-else variant="outline" :disabled="busy" @click="close(false)">{{ t('close') }}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
<style scoped>
label { display: grid; gap: .375rem; font-size: .75rem; color: var(--ld-text-muted); } dt { color: var(--ld-text-muted); } dd { min-width: 0; overflow-wrap: anywhere; }
</style>
