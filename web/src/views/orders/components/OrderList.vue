<script setup lang="ts">
import { Badge } from '@lingdian/console-ui/badge'
import { statusTagType } from '../order-presentation'
import { Table } from '@lingdian/console-ui/table'
import { useOrderLocale } from '../use-order-locale'
import type { OrderListItem, OrderQuickAction } from '../types'
import OrderRowActions from './OrderRowActions.vue'
defineProps<{ orders: OrderListItem[] }>()
defineEmits<{ detail: [id: string, event: MouseEvent]; action: [id: string, action: OrderQuickAction, trigger: HTMLElement] }>()
const { t, status, source, type, customer, date, money } = useOrderLocale()
</script>
<template>
  <Table
    container-class="hidden focus-visible:outline-2 focus-visible:-outline-offset-2 md:block xl:max-h-[min(38rem,max(10rem,100dvh-30rem))]"
    tabindex="0"
    :aria-label="t('list')"
    class="order-table"
  >
    <thead>
      <tr>
        <th scope="col">{{ t('order') }}</th>
        <th scope="col">{{ t('customer') }}</th>
        <th scope="col">{{ t('items') }}</th>
        <th scope="col">{{ t('status') }}</th>
        <th scope="col" class="numeric-column">{{ t('totalAmount') }}</th>
        <th scope="col">{{ t('created') }}</th>
        <th scope="col" class="numeric-column">{{ t('actions') }}</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="row in orders" :key="row.id" :data-order-id="row.id" class="cursor-pointer" @click="$emit('detail', row.id, $event)">
        <th scope="row" class="font-medium">
          <span class="flex items-center gap-1.5">
            <Badge v-if="row.pickup_code" variant="info">
              {{ t('pickup') }} <strong class="font-mono">{{ row.pickup_code }}</strong>
            </Badge>
            <Badge variant="secondary">{{ source(row.order_source) }}</Badge>
          </span>
          <span class="mt-1 block font-mono text-xs font-normal text-muted-foreground">{{ row.order_no }}</span>
        </th>
        <td>
          <span class="block max-w-40 whitespace-normal wrap-anywhere">{{ customer(row) }}</span>
          <span class="mt-1 block text-xs text-muted-foreground">{{ row.customer_mobile }}</span>
        </td>
        <td class="min-w-48 max-w-72 whitespace-normal">
          <p v-for="item in row.item_summary.slice(0, 2)" :key="item.id" class="break-words">
            {{ item.name }}<span v-if="item.sku_name"> · {{ item.sku_name }}</span> × {{ item.quantity }}
          </p>
          <p v-if="row.item_summary.length > 2" class="mt-1 text-xs text-muted-foreground">{{ t('moreItems') }}</p>
        </td>
        <td>
          <Badge :variant="statusTagType(row.status)">{{ status(row.status) }}</Badge>
          <span class="mt-1 block text-xs text-muted-foreground">{{ type(row.order_type) }}</span>
        </td>
        <td class="numeric-column font-semibold">{{ money(row.payment_required === false ? row.total_amount : row.payable_amount) }}</td>
        <td class="text-xs text-muted-foreground">{{ date(row.created_at) }}</td>
        <td class="numeric-column">
          <OrderRowActions :order="row" @detail="$emit('detail', row.id, $event)" @action="(action, trigger) => $emit('action', row.id, action, trigger)" />
        </td>
      </tr>
    </tbody>
  </Table>
  <ul class="table-scroll divide-y md:hidden" :aria-label="t('list')">
    <li v-for="row in orders" :key="row.id" :data-order-id="row.id" class="grid min-w-0 cursor-pointer gap-2 p-4 text-sm hover:bg-accent/50" @click="$emit('detail', row.id, $event)">
      <div class="flex flex-wrap items-start justify-between gap-2">
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-1.5">
            <Badge v-if="row.pickup_code" variant="info">
              {{ t('pickup') }} <strong class="font-mono">{{ row.pickup_code }}</strong>
            </Badge>
            <Badge variant="secondary">{{ source(row.order_source) }}</Badge>
          </div>
          <p class="mt-1 break-all font-mono text-xs text-muted-foreground">{{ row.order_no }}</p>
        </div>
        <Badge :variant="statusTagType(row.status)">{{ status(row.status) }}</Badge>
      </div>
      <p v-for="item in row.item_summary.slice(0, 2)" :key="item.id" class="break-words">
        {{ item.name }}<span v-if="item.sku_name"> · {{ item.sku_name }}</span> × {{ item.quantity }}
      </p>
      <p v-if="row.item_summary.length > 2" class="text-xs text-muted-foreground">{{ t('moreItems') }}</p>
      <p class="break-words text-xs text-muted-foreground">
        {{ type(row.order_type) }} · {{ customer(row) }} · {{ date(row.created_at) }}
      </p>
      <div class="flex items-center justify-between gap-3">
        <strong class="text-base tabular-nums">{{ money(row.payment_required === false ? row.total_amount : row.payable_amount) }}</strong>
        <OrderRowActions :order="row" @detail="$emit('detail', row.id, $event)" @action="(action, trigger) => $emit('action', row.id, action, trigger)" />
      </div>
    </li>
  </ul>
</template>

<style scoped>
.order-table th:first-child,
.order-table td:first-child {
  padding-inline-start: 1rem;
}

.order-table th:last-child,
.order-table td:last-child {
  padding-inline-end: 1rem;
}

.order-table .numeric-column {
  text-align: end;
  font-variant-numeric: tabular-nums;
}
</style>
