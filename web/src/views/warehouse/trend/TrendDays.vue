<script setup lang="ts">
import type { InventoryTrendDay } from '@lingdian/contracts'
import { Button } from '@/baseComponents/button'
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
  <div class="hidden overflow-x-auto md:block" tabindex="0" :aria-label="t('table')">
    <table>
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
            <button
              class="text-primary underline-offset-4 hover:underline"
              :disabled="disabled"
              @click="$emit('select', row)"
            >
              {{ row.date }}</button
            ><span class="mt-1 block text-xs font-normal text-muted-foreground">{{
              t(row.state === 'RECORDED' ? (row.partial ? 'partial' : 'full') : row.state)
            }}</span>
          </th>
          <td v-for="key in columns" :key="key" class="text-right tabular-nums">
            {{ row.state === 'RECORDED' ? number(row[key]) : '—' }}
          </td>
          <td class="tabular-nums">{{ row.state === 'RECORDED' ? row.movementCount : '—' }}</td>
          <td>
            <Button
              size="sm"
              variant="ghost"
              :aria-label="t('history') + ' ' + row.date"
              :disabled="disabled || row.state !== 'RECORDED' || !row.movementCount"
              @click="$emit('history', row)"
              >{{ t('history') }}</Button
            >
          </td>
        </tr>
      </tbody>
    </table>
  </div>
  <ul class="grid gap-3 md:hidden">
    <li
      v-for="row in days"
      :key="row.date"
      class="grid min-w-0 gap-3 rounded-md border p-3 text-sm"
      :class="row.date === selectedDate ? 'bg-muted' : ''"
    >
      <div class="flex flex-wrap items-center justify-between gap-2">
        <button class="font-medium text-primary" :disabled="disabled" @click="$emit('select', row)">
          {{ row.date }}</button
        ><span class="text-xs text-muted-foreground">{{
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
      <Button
        size="sm"
        variant="ghost"
        class="justify-self-end"
        :disabled="disabled || row.state !== 'RECORDED' || !row.movementCount"
        :aria-label="t('history') + ' ' + row.date"
        @click="$emit('history', row)"
        >{{ t('history') }}</Button
      >
    </li>
  </ul>
</template>
<style scoped>
table {
  width: 100%;
  border-collapse: collapse;
  text-align: start;
  font-size: 0.875rem;
}
th,
td {
  padding: 0.75rem;
  border-bottom: 1px solid var(--ld-border-default);
  white-space: nowrap;
}
thead th {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--ld-text-muted);
}
</style>
