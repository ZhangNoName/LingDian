<template>
  <div class="grid gap-5">
    <div class="grid gap-4 md:grid-cols-2">
      <StatCard label="低库存原料" value="12" trend="建议立即补货 4 项" />
      <StatCard label="待入库采购单" value="5" trend="今日到货 2 单" />
    </div>

    <div class="grid gap-5 xl:grid-cols-2">
      <PageSection title="仓储页面清单">
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
      </PageSection>

      <PageSection title="库存页建议字段">
        <ul class="list-disc space-y-2 pl-5 text-sm leading-7 text-muted-foreground">
          <li>原料名称、编码、单位、当前库存</li>
          <li>安全库存、最近入库时间、仓库位置</li>
          <li>状态、近 7 日出库量、操作入口</li>
        </ul>
      </PageSection>
    </div>
  </div>
</template>

<script setup lang="ts">
import PageSection from '@/components/shared/page-section/index.vue'
import StatCard from '@/components/shared/stat-card/index.vue'
import { Badge } from '@/components/ui/badge'
</script>
