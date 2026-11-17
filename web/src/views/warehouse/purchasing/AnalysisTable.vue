<script setup lang="ts">
import { Button } from '@/baseComponents/button'
import { usePurchasingLocale } from './locale'
export interface AnalysisRow {
  key: string
  title: string
  subtitle: string
  quantity: string
  value: string
  action: string
  actionLabel: string
  disabled?: boolean
}
defineProps<{ rows: AnalysisRow[]; titleHeading: string; quantityHeading: string; valueHeading: string }>()
defineEmits<{ action: [string] }>()
const { t } = usePurchasingLocale()
</script>
<template>
  <div class="hidden overflow-x-auto md:block">
    <table>
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
            <Button
              size="sm"
              variant="outline"
              :disabled="row.disabled"
              :aria-label="`${row.actionLabel} ${row.title}`"
              @click="$emit('action', row.action)"
            >
              {{ row.actionLabel }}
            </Button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
  <ul class="grid gap-3 md:hidden">
    <li v-for="row in rows" :key="row.key" class="grid gap-2 rounded-md border p-3 text-sm">
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
      <Button
        class="justify-self-end"
        size="sm"
        variant="outline"
        :disabled="row.disabled"
        :aria-label="`${row.actionLabel} ${row.title}`"
        @click="$emit('action', row.action)"
      >
        {{ row.actionLabel }}
      </Button>
    </li>
  </ul>
  <p v-if="!rows.length" class="help py-6 text-center">{{ t('empty') }}</p>
</template>
<style scoped src="./purchasing.css"></style>
