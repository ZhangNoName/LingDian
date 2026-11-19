<script setup lang="ts">
import type { InventoryItemContract, InventoryStatus } from '@lingdian/contracts'
import { Button } from '@lingdian/console-ui/button'
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
const number = (value: number) => value.toLocaleString(locale.value, { maximumFractionDigits: 3 })
const date = (value: string) =>
  new Intl.DateTimeFormat(locale.value, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
</script>
<template>
  <Table container-class="hidden md:block" tabindex="0" :aria-label="t('inventory')" class="border-collapse text-start">
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
          <Button
            type="button"
            variant="link"
            class="h-auto whitespace-normal break-words p-0 text-left focus-visible:underline"
            :aria-label="`${mt('more')} ${item.name}`"
            @click="$emit('detail', item)"
          >
            {{ item.name }}</Button
          ><span class="mt-1 block font-mono text-xs font-normal text-muted-foreground">{{
            item.code
          }}</span>
        </th>
        <td>{{ item.isActive === false ? lt('ARCHIVED') : t(statusKey[item.status]) }}</td>
        <td>{{ number(item.quantity) }} {{ item.unit }}</td>
        <td>{{ number(item.reservedQuantity ?? 0) }}</td>
        <td class="font-medium">{{ number(item.availableQuantity ?? item.quantity) }}</td>
        <td>{{ number(item.reorderPoint) }}</td>
        <td class="text-xs text-muted-foreground">{{ date(item.updatedAt) }}</td>
        <td>
          <div class="flex gap-1">
            <Button
              v-if="item.isActive !== false"
              variant="outline"
              size="sm"
              :aria-label="`${t('adjust')} ${item.name}`"
              @click="$emit('edit', item)"
              >{{ t('adjust') }}</Button
            ><Button
              variant="ghost"
              size="sm"
              :aria-label="`${t('records')} ${item.name}`"
              @click="$emit('history', item.id)"
              >{{ t('records') }}</Button
            >
          </div>
        </td>
      </tr>
    </tbody>
  </Table>
  <ul class="grid gap-3 p-4 md:hidden">
    <li v-for="item in items" :key="item.id" class="grid min-w-0 gap-3 rounded-md border p-3 text-sm">
      <div class="flex flex-wrap items-start justify-between gap-2">
        <Button
          type="button"
          variant="link"
          class="h-auto min-w-0 shrink whitespace-normal break-words p-0 text-left focus-visible:underline"
          :aria-label="`${mt('more')} ${item.name}`"
          @click="$emit('detail', item)"
        >
          {{ item.name }}</Button
        ><span class="text-xs text-muted-foreground">{{
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
        <Button
          v-if="item.isActive !== false"
          size="sm"
          variant="outline"
          :aria-label="`${t('adjust')} ${item.name}`"
          @click="$emit('edit', item)"
          >{{ t('adjust') }}</Button
        ><Button
          size="sm"
          variant="ghost"
          :aria-label="`${t('records')} ${item.name}`"
          @click="$emit('history', item.id)"
          >{{ t('records') }}</Button
        >
      </div>
    </li>
  </ul>
</template>
<style scoped>
th,
td {
  padding: 0.875rem 1rem;
  border-bottom: 1px solid var(--ld-border-default);
  white-space: nowrap;
}
thead th {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--ld-text-muted);
}
</style>
