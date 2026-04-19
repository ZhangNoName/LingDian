<template>
  <div class="grid gap-5">
    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <StatCard v-for="metric in metrics" :key="metric.label" v-bind="metric" />
    </div>

    <PageSection title="经营概览">
      <div class="rounded-2xl border border-dashed border-border bg-muted/20 p-6 text-sm text-muted-foreground">
        这里后续接图表组件，当前保留为经营分析主容器。
      </div>
    </PageSection>
  </div>
</template>

<script setup lang="ts">
import PageSection from '@/components/shared/page-section/index.vue'
import StatCard from '@/components/shared/stat-card/index.vue'

const metrics = [
  { label: '本周销售额', value: '¥ 186,420', trend: '周环比 +8.2%' },
  { label: '客单价', value: '¥ 32.7', trend: '稳定增长' },
  { label: '复购率', value: '31.5%', trend: '会员提升明显' },
  { label: '活动核销率', value: '24.1%', trend: '新人券表现最佳' },
]
</script>
