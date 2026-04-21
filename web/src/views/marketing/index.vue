<template>
  <Card class="rounded-lg border-border/80">
    <CardHeader>
      <CardTitle class="text-xl">营销中心</CardTitle>
      <CardDescription class="mt-1 leading-6">配置活动、优惠券、Banner、推荐位和首页专题。</CardDescription>
    </CardHeader>
    <CardContent>
      <div class="grid gap-3">
        <Card v-for="campaign in campaigns" :key="campaign.name" class="rounded-lg border-border/80">
          <CardContent class="flex items-start justify-between gap-4 p-4">
            <div>
              <p class="text-sm font-semibold text-foreground">{{ campaign.name }}</p>
              <p class="mt-1 text-sm leading-6 text-muted-foreground">{{ campaign.detail }}</p>
            </div>
            <Badge>{{ campaign.status }}</Badge>
          </CardContent>
        </Card>
      </div>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import { Badge } from '@/baseComponents/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/baseComponents/card'

const campaigns = [
  { name: '新人首单满 30 减 8', detail: '适用 18 家门店，自动发券。', status: '进行中' },
  { name: '午市双人套餐', detail: '工作日 11:00-14:00 生效。', status: '待开始' },
  { name: '首页 Banner 配置', detail: '支持跳转专题页、商品页、券包页。', status: '长期' },
]
</script>
