<template>
  <div class="page-stack">
    <PageSection title="统计分析" description="后续适合接入图表库，这里先落分析页面结构">
      <div class="stats-grid compact">
        <article v-for="metric in metrics" :key="metric.label" class="stat-card">
          <p class="stat-label">{{ metric.label }}</p>
          <p class="stat-value">{{ metric.value }}</p>
          <p class="stat-trend">{{ metric.trend }}</p>
        </article>
      </div>
    </PageSection>

    <div class="content-grid two-columns">
      <PageSection title="建议分析页">
        <div class="chip-wrap">
          <span class="mini-chip">经营总览</span>
          <span class="mini-chip">订单统计</span>
          <span class="mini-chip">商品排行</span>
          <span class="mini-chip">门店对比</span>
          <span class="mini-chip">用户分析</span>
          <span class="mini-chip">活动效果</span>
        </div>
      </PageSection>

      <PageSection title="关键指标">
        <ul class="detail-list">
          <li>销售额、订单数、客单价、支付转化率</li>
          <li>退款率、复购率、会员贡献占比</li>
          <li>爆品排行、滞销商品、活动核销率</li>
        </ul>
      </PageSection>
    </div>
  </div>
</template>

<script setup lang="ts">
import PageSection from '../components/PageSection.vue'

const metrics = [
  { label: '本周销售额', value: '¥ 186,420', trend: '周环比 +8.2%' },
  { label: '客单价', value: '¥ 32.7', trend: '稳定增长' },
  { label: '复购率', value: '31.5%', trend: '会员提升明显' },
  { label: '活动核销率', value: '24.1%', trend: '新人券表现最佳' },
]
</script>
