<template>
  <div class="grid gap-5">
    <div class="grid gap-4 md:grid-cols-2">
      <StatCard label="会员总量" value="42,680" trend="本月新增 2,146" />
      <StatCard label="本月复购率" value="31.5%" trend="会员贡献持续提升" />
    </div>

    <PageSection title="推荐页面" description="用户与会员模块建议拆成以下独立页面。">
      <div class="flex flex-wrap gap-2">
        <Badge variant="outline">用户列表</Badge>
        <Badge variant="outline">用户详情</Badge>
        <Badge variant="outline">会员等级</Badge>
        <Badge variant="outline">积分记录</Badge>
        <Badge variant="outline">优惠券记录</Badge>
        <Badge variant="outline">用户标签</Badge>
      </div>
    </PageSection>
  </div>
</template>

<script setup lang="ts">
import PageSection from '@/components/shared/page-section/index.vue'
import StatCard from '@/components/shared/stat-card/index.vue'
import { Badge } from '@/components/ui/badge'
</script>
