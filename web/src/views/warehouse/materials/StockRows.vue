<script setup lang="ts">
import type { InventoryItemContract, InventoryStatus } from '@lingdian/contracts'
import { CircleAlert, CircleCheck, CircleX, EyeIcon, History, Pencil } from '@lingdian/icons/web'
import { Badge } from '@lingdian/console-ui/badge'
import TableAction from '@/components/table/TableAction.vue'
import { Table } from '@lingdian/console-ui/table'
import { useLocale } from '@/i18n/locale'
import { useLifecycleLocale } from '../lifecycle/locale'
import { en, zh, type MessageKey } from '../messages'
import { useMaterialLocale } from './locale'
defineProps<{ items: InventoryItemContract[] }>()
defineEmits<{
  detail: [item: InventoryItemContract]
  edit: [item: InventoryItemContract]
  history: [id: string]
}>()
const { locale } = useLocale(),
  { t: lt } = useLifecycleLocale(),
  { t: mt } = useMaterialLocale()
const t = (key: MessageKey) => (locale.value === 'en-US' ? en : zh)[key]
const statusKey: Record<InventoryStatus, MessageKey> = { HEALTHY: 'healthy', LOW: 'low', OUT: 'out' }
const statusIcon = { HEALTHY: CircleCheck, LOW: CircleAlert, OUT: CircleX }
const statusColor = { HEALTHY: 'text-emerald-600', LOW: 'text-amber-600', OUT: 'text-destructive' }
const number = (value: number) => value.toLocaleString(locale.value, { maximumFractionDigits: 3 })
const date = (value: string) =>
  new Intl.DateTimeFormat(locale.value, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
</script>
<template>
  <Table framed container-class="mx-4 mt-4 hidden md:block" tabindex="0" :aria-label="t('inventory')" class="border-collapse text-start">
    <thead>
      <tr>
        <th>{{ t('name') }}</th>
        <th>{{ t('status') }}</th>
        <th>{{ t('quantity') }}</th>
        <th>{{ t('reserved') }}</th>
        <th>{{ t('available') }}</th>
        <th>{{ t('threshold') }}</th>
        <th>{{ t('updated') }}</th>
        <th>{{ t('actions') }}</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="item in items" :key="item.id">
        <th scope="row">
          <span class="break-words font-medium">{{ item.name }}</span><span class="mt-1 block font-mono text-xs font-normal text-muted-foreground">{{
            item.code
          }}</span>
        </th>
        <td>
          <Badge v-if="item.isActive === false" variant="outline">{{ lt('ARCHIVED') }}</Badge>
          <span v-else class="inline-flex items-center gap-2">
            <component :is="statusIcon[item.status]" :class="statusColor[item.status]" class="size-3.5" aria-hidden="true" />
            {{ t(statusKey[item.status]) }}
          </span>
        </td>
        <td>{{ number(item.quantity) }} {{ item.unit }}</td>
        <td>{{ number(item.reservedQuantity ?? 0) }}</td>
        <td class="font-medium">{{ number(item.availableQuantity ?? item.quantity) }}</td>
        <td>{{ number(item.reorderPoint) }}</td>
        <td class="text-xs text-muted-foreground">{{ date(item.updatedAt) }}</td>
        <td>
          <div class="flex gap-1">
            <TableAction
              :icon="EyeIcon"
              :label="mt('more')"
              :aria-label="`${mt('more')} ${item.name}`"
              @click="$emit('detail', item)"
            />
            <TableAction
              v-if="item.isActive !== false"
              :icon="Pencil"
              :label="t('adjust')"
              :aria-label="`${t('adjust')} ${item.name}`"
              @click="$emit('edit', item)"
            />
            <TableAction
              :icon="History"
              :label="t('records')"
              :aria-label="`${t('records')} ${item.name}`"
              @click="$emit('history', item.id)"
            />
          </div>
        </td>
      </tr>
    </tbody>
  </Table>
  <ul class="table-scroll grid gap-3 p-4 md:hidden">
    <li v-for="item in items" :key="item.id" class="grid min-w-0 gap-3 border p-3 text-sm">
      <div class="flex flex-wrap items-start justify-between gap-2">
        <span class="break-words font-medium">{{ item.name }}</span><span class="text-xs text-muted-foreground">{{
          item.isActive === false ? lt('ARCHIVED') : t(statusKey[item.status])
        }}</span>
      </div>
      <p class="break-words font-mono text-xs text-muted-foreground">{{ item.code }} · {{ item.unit }}</p>
      <dl class="grid grid-cols-3 gap-2">
        <div
          v-for="metric in [
            { key: 'quantity' as const, value: item.quantity },
            { key: 'reserved' as const, value: item.reservedQuantity ?? 0 },
            { key: 'available' as const, value: item.availableQuantity ?? item.quantity },
          ]"
          :key="metric.key"
        >
          <dt class="text-xs text-muted-foreground">{{ t(metric.key) }}</dt>
          <dd class="mt-1 break-words tabular-nums">{{ number(metric.value) }}</dd>
        </div>
      </dl>
      <p class="text-xs text-muted-foreground">
        {{ t('threshold') }}: {{ number(item.reorderPoint) }} · {{ t('updated') }}: {{ date(item.updatedAt) }}
      </p>
      <div class="flex justify-end gap-2">
        <TableAction
          :icon="EyeIcon"
          :label="mt('more')"
          :aria-label="`${mt('more')} ${item.name}`"
          @click="$emit('detail', item)"
        />
        <TableAction
          v-if="item.isActive !== false"
          :icon="Pencil"
          :label="t('adjust')"
          :aria-label="`${t('adjust')} ${item.name}`"
          @click="$emit('edit', item)"
        />
        <TableAction
          :icon="History"
          :label="t('records')"
          :aria-label="`${t('records')} ${item.name}`"
          @click="$emit('history', item.id)"
        />
      </div>
    </li>
  </ul>
</template>
