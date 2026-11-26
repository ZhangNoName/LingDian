<script setup lang="ts">
import { computed, ref } from 'vue'
import { DropdownMenu } from '@lingdian/console-ui/dropdown'
import { EyeIcon, MoreHorizontal } from '@lingdian/icons/web'
import TableAction from '@/components/table/TableAction.vue'
import { canCollectOrderPayment, orderStatusActions } from '../order-presentation'
import { useOrderLocale } from '../use-order-locale'
import type { OrderListItem, OrderQuickAction } from '../types'

const props = defineProps<{ order: OrderListItem }>()
const emit = defineEmits<{ detail: [event: MouseEvent]; action: [action: OrderQuickAction, trigger: HTMLElement] }>()
const { locale, t } = useOrderLocale()
const trigger = ref<InstanceType<typeof TableAction>>()
const actions = computed<OrderQuickAction[]>(() => [
  ...(canCollectOrderPayment(props.order) ? [{ value: 'WECHAT_PAYMENT' as const, label: t('wechatScanTitle') }] : []),
  ...orderStatusActions(props.order, locale.value),
])

function select(value: string) {
  const action = actions.value.find(item => item.value === value)
  const button = trigger.value?.$el
  if (action && button instanceof HTMLElement) emit('action', action, button)
}
</script>

<template>
  <div class="flex items-center justify-end gap-1" @click.stop>
    <TableAction
      data-order-detail
      :icon="EyeIcon"
      :label="t('detail')"
      :aria-label="`${t('detail')} ${order.order_no}`"
      @click="$emit('detail', $event)"
    />
    <DropdownMenu v-if="actions.length" :items="actions" @select="select">
      <TableAction
        ref="trigger"
        data-order-actions
        :icon="MoreHorizontal"
        :label="t('orderActions')"
        :aria-label="`${t('orderActions')} ${order.order_no}`"
      />
    </DropdownMenu>
  </div>
</template>
