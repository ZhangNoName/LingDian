<script setup lang="ts">
import type { Component } from 'vue'
import TableAction from '@/components/table/TableAction.vue'
import { ShoppingCart } from '@lingdian/icons/web'
import { Table } from '@lingdian/console-ui/table'
import { usePurchasingLocale } from './locale'
export interface AnalysisRow {
  key: string
  title: string
  subtitle: string
  quantity: string
  value: string
  action: string
  actionLabel: string
  actionIcon: Component
  disabled?: boolean
  secondaryAction?: string
  secondaryLabel?: string
}
defineProps<{ rows: AnalysisRow[]; titleHeading: string; quantityHeading: string; valueHeading: string }>()
defineEmits<{ action: [string]; secondary: [string] }>()
const { t } = usePurchasingLocale()
</script>
<template>
  <Table framed tabindex="0" container-class="hidden md:block" class="border-collapse text-start">
    <thead>
      <tr>
        <th>{{ titleHeading }}</th>
        <th>{{ quantityHeading }}</th>
        <th>{{ valueHeading }}</th>
        <th></th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="row in rows" :key="row.key">
        <th scope="row" class="max-w-sm font-medium">
          <p class="break-words text-foreground">{{ row.title }}</p>
          <p class="help mt-1 break-words font-normal">{{ row.subtitle }}</p>
        </th>
        <td class="tabular-nums">{{ row.quantity }}</td>
        <td class="tabular-nums">{{ row.value }}</td>
        <td>
          <div class="flex flex-wrap justify-end gap-2">
            <TableAction :icon="ShoppingCart" :label="row.secondaryLabel ?? row.title"
              v-if="row.secondaryAction"
              variant="ghost"
              :aria-label="`${row.secondaryLabel} ${row.title}`"
              @click="$emit('secondary', row.secondaryAction)" />
            <TableAction :icon="row.actionIcon" :label="row.actionLabel"
              :disabled="row.disabled"
              :aria-label="`${row.actionLabel} ${row.title}`"
              @click="$emit('action', row.action)" />
          </div>
        </td>
      </tr>
    </tbody>
  </Table>
  <ul class="table-scroll grid gap-3 md:hidden">
    <li v-for="row in rows" :key="row.key" class="grid gap-2 border p-3 text-sm">
      <strong class="break-words">{{ row.title }}</strong>
      <p class="help break-words">{{ row.subtitle }}</p>
      <dl class="grid grid-cols-2 gap-3">
        <div>
          <dt class="help">{{ quantityHeading }}</dt>
          <dd class="tabular-nums">{{ row.quantity }}</dd>
        </div>
        <div>
          <dt class="help">{{ valueHeading }}</dt>
          <dd class="tabular-nums">{{ row.value }}</dd>
        </div>
      </dl>
      <div class="flex flex-wrap justify-end gap-2">
        <TableAction :icon="ShoppingCart" :label="row.secondaryLabel ?? row.title"
          v-if="row.secondaryAction"
          variant="ghost"
          :aria-label="`${row.secondaryLabel} ${row.title}`"
          @click="$emit('secondary', row.secondaryAction)" />
        <TableAction :icon="row.actionIcon" :label="row.actionLabel"
          class="justify-self-end"
          :disabled="row.disabled"
          :aria-label="`${row.actionLabel} ${row.title}`"
          @click="$emit('action', row.action)" />
      </div>
    </li>
  </ul>
  <p v-if="!rows.length" class="help py-6 text-center">{{ t('empty') }}</p>
</template>
<style scoped src="./purchasing.css"></style>
