<template>
  <div class="page-stack">
    <PageSection title="用户与会员" description="沉淀用户资产、会员等级、优惠券和积分体系">
      <div class="content-grid two-columns">
        <div class="surface-subcard">
          <p class="subcard-label">会员总量</p>
          <p class="subcard-value">42,680</p>
        </div>
        <div class="surface-subcard">
          <p class="subcard-label">本月复购率</p>
          <p class="subcard-value">31.5%</p>
        </div>
      </div>
    </PageSection>

    <PageSection title="推荐页面">
      <div class="chip-wrap">
        <span class="mini-chip">用户列表</span>
        <span class="mini-chip">用户详情</span>
        <span class="mini-chip">会员等级</span>
        <span class="mini-chip">积分记录</span>
        <span class="mini-chip">优惠券记录</span>
        <span class="mini-chip">用户标签</span>
      </div>
    </PageSection>
  </div>
</template>

<script setup lang="ts">
import PageSection from '../components/PageSection.vue'
</script>
