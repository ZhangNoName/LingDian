<template>
  <section class="metrics-grid">
    <el-card v-for="metric in metrics" :key="metric.label" shadow="never" class="metric-card">
      <p class="metric-label">{{ metric.label }}</p>
      <p class="metric-value">{{ metric.value }}</p>
      <p class="metric-note">{{ metric.note }}</p>
    </el-card>
  </section>
</template>

<script setup lang="ts">
import { ElCard } from 'element-plus'

defineProps<{
  metrics: Array<{
    label: string
    value: number
    note: string
  }>
}>()
</script>

<style scoped>
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.metric-card {
  border-radius: 8px;
}

.metric-label,
.metric-note {
  color: var(--muted-foreground);
  font-size: 13px;
}

.metric-value {
  margin-top: 10px;
  color: var(--foreground);
  font-size: 28px;
  font-weight: 700;
}

.metric-note {
  margin-top: 6px;
}

@media (max-width: 1024px) {
  .metrics-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .metrics-grid {
    grid-template-columns: 1fr;
  }
}
</style>
