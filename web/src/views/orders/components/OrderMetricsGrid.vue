<template>
  <section class="metrics-grid">
    <article v-for="metric in metrics" :key="metric.label" class="metric-card">
      <p>{{ metric.label }}</p>
      <strong>{{ metric.value }}</strong>
      <span>{{ metric.note }}</span>
    </article>
  </section>
</template>

<script setup lang="ts">
import type { OrderSummaryMetric } from '../types'

defineProps<{
  metrics: OrderSummaryMetric[]
}>()
</script>

<style scoped>
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 14px;
}

.metric-card {
  display: grid;
  gap: 8px;
  padding: 18px 20px;
  border: 1px solid #d6e6f7;
  border-radius: 16px;
  background:
    radial-gradient(circle at top right, rgba(38, 132, 255, 0.18), transparent 40%),
    linear-gradient(180deg, #ffffff 0%, #f7fbff 100%);
  box-shadow: 0 14px 30px rgba(28, 76, 128, 0.08);
}

.metric-card p {
  margin: 0;
  color: #5f6b7a;
  font-size: 13px;
}

.metric-card strong {
  font-size: 30px;
  line-height: 1;
  color: #142033;
}

.metric-card span {
  color: #6f7b89;
  font-size: 12px;
}

@media (max-width: 1400px) {
  .metrics-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .metrics-grid {
    grid-template-columns: 1fr;
  }
}
</style>
