<template>
  <div class="grid gap-5">
    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Card v-for="capability in capabilities" :key="capability.to" class="rounded-lg border-border/80">
        <CardContent class="p-5">
          <div class="flex items-start justify-between gap-3">
            <p class="font-semibold text-foreground">{{ capability.label }}</p>
            <Badge variant="secondary">已接入</Badge>
          </div>
          <p class="mt-3 text-sm leading-6 text-muted-foreground">{{ capability.description }}</p>
          <Button as-child variant="link" class="mt-3 px-0">
            <RouterLink :to="capability.to">进入模块</RouterLink>
          </Button>
        </CardContent>
      </Card>
    </div>

    <div class="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
      <Card class="rounded-lg border-border/80">
        <CardHeader>
          <CardTitle class="text-xl">经营数据</CardTitle>
        </CardHeader>
        <CardContent>
          <div class="rounded-lg border border-dashed border-border bg-muted/20 p-6">
            <p class="font-medium text-foreground">暂未接入经营聚合指标</p>
            <p class="mt-2 text-sm leading-6 text-muted-foreground">
              为避免把演示数字误当成真实经营数据，工作台只展示已经接入后端的能力入口。订单与商品数据请进入对应模块查看。
            </p>
          </div>
        </CardContent>
      </Card>

      <Card class="rounded-lg border-border/80">
        <CardHeader>
          <CardTitle class="text-xl">快捷操作</CardTitle>
        </CardHeader>
        <CardContent>
          <div class="grid gap-2">
            <Button v-for="action in dashboardActions" :key="action.to" as-child variant="outline" class="justify-start rounded-md">
              <RouterLink :to="action.to">{{ action.label }}</RouterLink>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Badge } from '@/baseComponents/badge'
import { Button } from '@/baseComponents/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/baseComponents/card'
import { RouterLink } from 'vue-router'
import { dashboardActions } from '@/config/navigation'

const capabilities = [
  { label: '门店信息', description: '查看当前账号唯一可管理的主门店与营业状态。', to: '/stores' },
  { label: '商品与菜单', description: '维护商品配置、SKU 价格库存与选择组。', to: '/products' },
  { label: '订单管理', description: '查询订单、查看详情并执行服务端允许的状态流转。', to: '/orders' },
  { label: '外部集成', description: '查看并启停部署端已经配置的连接器能力。', to: '/settings' },
]
</script>
