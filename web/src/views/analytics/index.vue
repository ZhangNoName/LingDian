<template>
  <div class="grid gap-5">
    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Card v-for="metric in metrics" :key="metric.label" class="rounded-lg border-border/80">
        <CardContent class="p-5">
          <p class="text-sm text-muted-foreground">{{ metric.label }}</p>
          <p class="mt-3 text-2xl font-semibold text-foreground">{{ metric.value }}</p>
          <p class="mt-2 text-xs text-muted-foreground">{{ metric.trend }}</p>
        </CardContent>
      </Card>
    </div>

    <Card class="rounded-lg border-border/80">
      <CardHeader>
        <CardTitle class="text-xl">经营概览</CardTitle>
      </CardHeader>
      <CardContent>
        <div class="rounded-lg border border-dashed border-border bg-muted/20 p-6 text-sm text-muted-foreground">
          这里后续接图表组件，当前保留为经营分析主容器。
        </div>
      </CardContent>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { Card, CardContent, CardHeader, CardTitle } from '@/baseComponents/card'

const metrics = [
  { label: '本周销售额', value: '¥ 186,420', trend: '周环比 +8.2%' },
  { label: '客单价', value: '¥ 32.7', trend: '稳定增长' },
  { label: '复购率', value: '31.5%', trend: '会员提升明显' },
  { label: '活动核销率', value: '24.1%', trend: '新人券表现最佳' },
]
</script>
