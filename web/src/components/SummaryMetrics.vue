<script setup lang="ts">
import { Disclosure } from '@lingdian/console-ui/collapsible'

defineProps<{
  metrics: { label: string; value: string | number; tone?: 'warning' | 'success' | 'info' }[]
  moreLabel: string
  desktopColumns: string
}>()
</script>

<template>
  <div class="overflow-hidden rounded-xl border bg-card">
    <dl class="grid grid-cols-3 gap-px bg-border" :class="desktopColumns">
      <div
        v-for="(metric, index) in metrics"
        :key="metric.label"
        class="min-w-0 bg-card p-3 sm:p-4"
        :class="{ 'hidden sm:block': index >= 3 }"
        :data-tone="metric.tone"
      >
        <dt class="metric-label flex items-start gap-1.5 text-xs font-medium text-muted-foreground">{{ metric.label }}</dt>
        <dd class="mt-1 wrap-anywhere text-xl font-semibold tracking-tight tabular-nums sm:mt-2 sm:text-2xl">{{ metric.value }}</dd>
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

<style scoped>
[data-tone="info"] { --summary-indicator: var(--primary); }
[data-tone="warning"] { --summary-indicator: var(--state-warning-ink); }
[data-tone="success"] { --summary-indicator: var(--state-success-ink); }

[data-tone] .metric-label::before {
  content: "";
  flex: none;
  inline-size: .375rem;
  block-size: .375rem;
  margin-block-start: .3rem;
  background: var(--summary-indicator);
}
</style>
