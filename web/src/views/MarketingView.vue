<template>
  <div class="page-stack">
    <PageSection title="营销中心" description="配置活动、优惠券、Banner 和推荐位">
      <div class="list-rows">
        <div v-for="campaign in campaigns" :key="campaign.name" class="list-row">
          <div>
            <p class="list-title">{{ campaign.name }}</p>
            <p class="list-text">{{ campaign.detail }}</p>
          </div>
          <span class="pill">{{ campaign.status }}</span>
        </div>
      </div>
    </PageSection>
  </div>
</template>

<script setup lang="ts">
import PageSection from '../components/PageSection.vue'

const campaigns = [
  { name: '新人首单满 30 减 8', detail: '适用 18 家门店，自动发券。', status: '进行中' },
  { name: '午市双人套餐', detail: '工作日 11:00-14:00 生效。', status: '待开始' },
  { name: '首页 Banner 配置', detail: '支持跳转专题页、商品页、券包页。', status: '长期' },
]
</script>
