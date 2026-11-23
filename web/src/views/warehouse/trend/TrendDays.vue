<script setup lang="ts">
import type { InventoryTrendDay } from '@lingdian/contracts'
import { CalendarDays, History } from '@lingdian/icons/web'
import TableAction from '@/components/table/TableAction.vue'
import { Table } from '@lingdian/console-ui/table'
import { useTrendLocale } from './locale'
defineProps<{ days: InventoryTrendDay[]; unit: string; selectedDate: string; disabled: boolean }>()
defineEmits<{ select: [day: InventoryTrendDay]; history: [day: InventoryTrendDay] }>()
const { t, number } = useTrendLocale()
const columns = [
  'received',
  'issued',
  'lost',
  'countGain',
  'countLoss',
  'closing',
  'reservedClosing',
  'availableClosing',
] as const
</script>
<template>
  <Table framed container-class="hidden md:block" tabindex="0" :aria-label="t('table')" class="border-collapse text-start">
    <thead>
      <tr>
        <th>{{ t('date') }}</th>
        <th v-for="key in columns" :key="key" class="text-right">{{ t(key) }}</th>
        <th>{{ t('movementCount') }}</th>
        <th />
      </tr>
    </thead>
    <tbody>
      <tr v-for="row in days" :key="row.date" :class="row.date === selectedDate ? 'bg-muted' : ''">
        <th scope="row">
          <span class="break-words font-medium">{{ row.date }}</span><span class="mt-1 block text-xs font-normal text-muted-foreground">{{
            t(row.state === 'RECORDED' ? (row.partial ? 'partial' : 'full') : row.state)
          }}</span>
        </th>
        <td v-for="key in columns" :key="key" class="text-right tabular-nums">
          {{ row.state === 'RECORDED' ? number(row[key]) : '—' }}
        </td>
        <td class="tabular-nums">{{ row.state === 'RECORDED' ? row.movementCount : '—' }}</td>
        <td>
          <div class="flex gap-1">
            <TableAction
              :icon="CalendarDays"
              :label="t('select')"
              :aria-label="`${t('select')} ${row.date}`"
              :disabled="disabled"
              @click="$emit('select', row)"
            />
            <TableAction
              :icon="History"
              :label="t('history')"
              :aria-label="`${t('history')} ${row.date}`"
              :disabled="disabled || row.state !== 'RECORDED' || !row.movementCount"
              @click="$emit('history', row)"
            />
          </div>
        </td>
      </tr>
    </tbody>
  </Table>
  <ul class="table-scroll grid gap-3 md:hidden">
    <li
      v-for="row in days"
      :key="row.date"
      class="grid min-w-0 gap-3 border p-3 text-sm"
      :class="row.date === selectedDate ? 'bg-muted' : ''"
    >
      <div class="flex flex-wrap items-center justify-between gap-2">
        <span class="break-words font-medium">{{ row.date }}</span><span class="text-xs text-muted-foreground">{{
          t(row.state === 'RECORDED' ? (row.partial ? 'partial' : 'full') : row.state)
        }}</span>
      </div>
      <dl class="grid grid-cols-2 gap-3">
        <div v-for="key in ['closing', 'availableClosing'] as const" :key="key">
          <dt class="text-xs text-muted-foreground">{{ t(key) }}</dt>
          <dd class="mt-1 break-words tabular-nums">
            {{ row.state === 'RECORDED' ? number(row[key]) + ' ' + unit : '—' }}
          </dd>
        </div>
      </dl>
      <p v-if="row.state === 'RECORDED'" class="break-words text-xs text-muted-foreground">
        {{ t('received') }} {{ number(row.received) }} · {{ t('issued') }} {{ number(row.issued) }} ·
        {{ t('lost') }} {{ number(row.lost)
        }}<template v-if="row.countGain || row.countLoss">
          · {{ t('countGain') }} {{ number(row.countGain) }} · {{ t('countLoss') }}
          {{ number(row.countLoss) }}</template
        >
      </p>
      <div class="flex justify-end gap-2">
        <TableAction
          :icon="CalendarDays"
          :label="t('select')"
          :aria-label="`${t('select')} ${row.date}`"
          :disabled="disabled"
          @click="$emit('select', row)"
        />
        <TableAction
          :icon="History"
          :label="t('history')"
          :aria-label="`${t('history')} ${row.date}`"
          :disabled="disabled || row.state !== 'RECORDED' || !row.movementCount"
          @click="$emit('history', row)"
        />
      </div>
    </li>
  </ul>
</template>
