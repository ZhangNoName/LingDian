<script setup lang="ts">
import { Disclosure } from '@lingdian/console-ui/collapsible'

defineProps<{
  metrics: { label: string; value: string | number }[]
  moreLabel: string
  desktopColumns: string
}>()
</script>

<template>
  <div class="border bg-card">
    <dl class="grid grid-cols-3 gap-px bg-border" :class="desktopColumns">
      <div
        v-for="(metric, index) in metrics"
        :key="metric.label"
        class="min-w-0 bg-card p-3 sm:p-4"
        :class="{ 'hidden sm:block': index >= 3 }"
      >
        <dt class="text-xs text-muted-foreground">{{ metric.label }}</dt>
        <dd class="mt-1 break-words text-xl font-semibold tabular-nums sm:mt-2">{{ metric.value }}</dd>
      </div>
    </dl>
    <Disclosure v-if="metrics.length > 3" class="border-t px-3 py-1 text-sm sm:hidden">
      <template #label>{{ moreLabel }}</template>
      <dl class="grid gap-2 pb-2 pt-1">
        <div v-for="metric in metrics.slice(3)" :key="metric.label" class="flex justify-between gap-3">
          <dt class="text-muted-foreground">{{ metric.label }}</dt>
          <dd class="break-words text-end font-medium tabular-nums">{{ metric.value }}</dd>
        </div>
      </dl>
    </Disclosure>
  </div>
</template>
