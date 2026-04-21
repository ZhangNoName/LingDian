<template>
  <div class="grid gap-5">
    <div class="grid gap-4 md:grid-cols-2">
      <Card class="rounded-lg border-border/80">
        <CardContent class="p-5">
          <p class="text-sm text-muted-foreground">低库存原料</p>
          <p class="mt-3 text-2xl font-semibold text-foreground">12</p>
          <p class="mt-2 text-xs text-muted-foreground">建议立即补货 4 项</p>
        </CardContent>
      </Card>
      <Card class="rounded-lg border-border/80">
        <CardContent class="p-5">
          <p class="text-sm text-muted-foreground">待入库采购单</p>
          <p class="mt-3 text-2xl font-semibold text-foreground">5</p>
          <p class="mt-2 text-xs text-muted-foreground">今日到货 2 单</p>
        </CardContent>
      </Card>
    </div>

    <div class="grid gap-5 xl:grid-cols-2">
      <Card class="rounded-lg border-border/80">
        <CardHeader>
          <CardTitle class="text-xl">仓储页面清单</CardTitle>
        </CardHeader>
        <CardContent>
          <div class="flex flex-wrap gap-2">
            <Badge variant="outline">仓库列表</Badge>
            <Badge variant="outline">库存商品</Badge>
            <Badge variant="outline">入库单</Badge>
            <Badge variant="outline">出库单</Badge>
            <Badge variant="outline">调拨单</Badge>
            <Badge variant="outline">盘点单</Badge>
            <Badge variant="outline">损耗记录</Badge>
            <Badge variant="outline">采购单</Badge>
            <Badge variant="outline">供应商管理</Badge>
          </div>
        </CardContent>
      </Card>

      <Card class="rounded-lg border-border/80">
        <CardHeader>
          <CardTitle class="text-xl">库存页建议字段</CardTitle>
        </CardHeader>
        <CardContent>
          <ul class="list-disc space-y-2 pl-5 text-sm leading-7 text-muted-foreground">
            <li>原料名称、编码、单位、当前库存</li>
            <li>安全库存、最近入库时间、仓库位置</li>
            <li>状态、近 7 日出库量、操作入口</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Badge } from '@/baseComponents/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/baseComponents/card'
</script>
