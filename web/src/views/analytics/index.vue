<template>
  <div class="grid gap-5">
    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Card v-for="metric in metrics" :key="metric.label" class="border-border/80">
        <CardContent class="p-5">
          <p class="text-sm text-muted-foreground">{{ metric.label }}</p>
          <p class="mt-3 text-2xl font-semibold text-foreground">{{ metric.value }}</p>
          <p v-if="metric.trend" class="mt-2 text-xs text-muted-foreground">{{ metric.trend }}</p>
        </CardContent>
      </Card>
    </div>

  </div>
</template>

<script setup lang="ts">
import { Card, CardContent } from '@lingdian/console-ui/card'

const metrics = [
  { label: '本周销售额', value: '¥ 186,420', trend: '周环比 +8.2%' },
  { label: '客单价', value: '¥ 32.7' },
  { label: '复购率', value: '31.5%' },
  { label: '活动核销率', value: '24.1%' },
]
</script>
