<template>
  <div class="grid gap-5">
    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <StatCard v-for="card in cards" :key="card.label" v-bind="card" />
    </div>

    <div class="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
      <PageSection title="待办事项">
        <div class="grid gap-3">
          <div
            v-for="item in todos"
            :key="item.title"
            class="flex items-start justify-between gap-4 rounded-2xl border border-border bg-muted/30 p-4"
          >
            <div>
              <p class="text-sm font-semibold text-foreground">{{ item.title }}</p>
              <p class="mt-1 text-sm leading-6 text-muted-foreground">{{ item.detail }}</p>
            </div>
            <Badge :variant="item.variant">{{ item.level }}</Badge>
          </div>
        </div>
      </PageSection>

      <PageSection title="快捷操作">
        <div class="grid gap-2">
          <Button variant="outline" class="justify-start rounded-2xl">新建商品</Button>
          <Button variant="outline" class="justify-start rounded-2xl">查看异常订单</Button>
          <Button variant="outline" class="justify-start rounded-2xl">处理低库存</Button>
          <Button variant="outline" class="justify-start rounded-2xl">进入经营分析</Button>
        </div>
      </PageSection>
    </div>
  </div>
</template>

<script setup lang="ts">
import PageSection from '@/components/shared/page-section/index.vue'
import StatCard from '@/components/shared/stat-card/index.vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

const cards = [
  { label: '今日销售额', value: '¥ 28,640', trend: '较昨日 +12.4%' },
  { label: '有效订单', value: '1,284', trend: '堂食占比 41%' },
  { label: '退款单量', value: '19', trend: '退款率 1.48%' },
  { label: '低库存预警', value: '12', trend: '需尽快补货' },
]

const todos = [
  { title: '退款待审核', detail: '当前有 6 笔订单等待店长处理。', level: '高优', variant: 'destructive' as const },
  { title: '门店暂停营业', detail: '浦东陆家嘴店设置为今日 20:30 提前打烊。', level: '提醒', variant: 'secondary' as const },
  { title: '库存不足', detail: '鸡腿原料库存低于安全线，影响 3 个 SKU。', level: '紧急', variant: 'outline' as const },
]
</script>
