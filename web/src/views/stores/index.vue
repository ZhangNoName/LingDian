<template>
  <div class="grid gap-5">
    <PageSection title="门店列表">
      <template #actions>
        <div class="flex flex-wrap items-center gap-2">
          <Input class="w-64 rounded-full" placeholder="搜索门店名称 / 编号 / 区域" />
          <Button class="rounded-full">新建门店</Button>
        </div>
      </template>

      <div class="rounded-2xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>门店</TableHead>
              <TableHead>营业状态</TableHead>
              <TableHead>服务方式</TableHead>
              <TableHead>今日订单</TableHead>
              <TableHead>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="store in stores" :key="store.name">
              <TableCell class="font-medium">{{ store.name }}</TableCell>
              <TableCell>{{ store.status }}</TableCell>
              <TableCell>{{ store.mode }}</TableCell>
              <TableCell>{{ store.orders }}</TableCell>
              <TableCell>
                <Button variant="link" class="px-0">查看详情</Button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </PageSection>
  </div>
</template>

<script setup lang="ts">
import PageSection from '@/components/shared/page-section/index.vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const stores = [
  { name: '陆家嘴示范店', status: '营业中', mode: '堂食 / 自提 / 外带', orders: '286' },
  { name: '徐汇日月光店', status: '备餐高峰', mode: '堂食 / 自提', orders: '194' },
  { name: '虹桥商务店', status: '暂停接单', mode: '堂食', orders: '38' },
]
</script>
