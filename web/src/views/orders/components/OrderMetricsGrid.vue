<script setup lang="ts">
import type { OrderSummaryMetric } from '../types'
defineProps<{ metrics: OrderSummaryMetric[]; moreLabel: string; hint: string }>()
</script>
<template>
  <div class="hidden sm:block"><dl class="grid gap-3 sm:grid-cols-3 xl:grid-cols-6"><div v-for="metric in metrics" :key="metric.label" class="min-w-0 rounded-lg border bg-card p-4"><dt class="text-xs leading-5 text-muted-foreground">{{ metric.label }}</dt><dd class="mt-2 break-words text-xl font-semibold tabular-nums">{{ metric.value }}</dd></div></dl><p class="mt-3 text-xs leading-5 text-muted-foreground">{{ hint }}</p></div>
  <div class="grid gap-2 sm:hidden"><dl class="grid grid-cols-3 gap-2"><div v-for="metric in metrics.slice(0,3)" :key="metric.label" class="min-w-0 rounded-lg border bg-card p-3"><dt class="text-xs leading-5 text-muted-foreground">{{ metric.label }}</dt><dd class="mt-1 text-xl font-semibold tabular-nums">{{ metric.value }}</dd></div></dl><details class="rounded-md border bg-card px-3 py-2 text-xs"><summary class="cursor-pointer text-muted-foreground">{{ moreLabel }}</summary><dl class="mt-3 grid gap-3"><div v-for="metric in metrics.slice(3)" :key="metric.label" class="flex items-start justify-between gap-3"><dt>{{ metric.label }}</dt><dd class="shrink-0 font-semibold tabular-nums">{{ metric.value }}</dd></div></dl><p class="mt-3 leading-5 text-muted-foreground">{{ hint }}</p></details></div>
</template>
