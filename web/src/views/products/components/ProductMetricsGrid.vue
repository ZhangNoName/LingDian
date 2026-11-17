<script setup lang="ts">
import { useProductLocale } from '../use-product-locale'
defineProps<{ metrics: Array<{ label: string; value: number | string }> }>()
const { t } = useProductLocale()
</script>
<template>
  <div class="hidden sm:block">
    <dl class="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <div v-for="metric in metrics" :key="metric.label" class="rounded-lg border bg-card p-4">
        <dt class="text-xs text-muted-foreground">{{ metric.label }}</dt>
        <dd class="mt-2 text-xl font-semibold tabular-nums">{{ metric.value }}</dd>
      </div>
    </dl>
  </div>
  <div class="grid gap-2 sm:hidden">
    <dl class="grid grid-cols-3 gap-2">
      <div v-for="metric in metrics.slice(0, 3)" :key="metric.label" class="rounded-lg border bg-card p-3">
        <dt class="text-xs text-muted-foreground">{{ metric.label }}</dt>
        <dd class="mt-1 text-xl font-semibold tabular-nums">{{ metric.value }}</dd>
      </div>
    </dl>
    <details class="rounded-md border bg-card px-3 py-2 text-xs">
      <summary>{{ t('moreMetrics') }}</summary>
      <dl class="mt-3 flex justify-between gap-3">
        <div v-for="metric in metrics.slice(3)" :key="metric.label">
          <dt>{{ metric.label }}</dt>
          <dd class="mt-1 font-semibold">{{ metric.value }}</dd>
        </div>
      </dl>
    </details>
  </div>
</template>
