<template>
  <div class="grid gap-5">
    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <StatCard v-for="metric in metrics" :key="metric.label" v-bind="metric" />
    </div>

    <PageSection title="商品列表">
      <template #actions>
        <div class="flex flex-wrap gap-2">
          <Input class="w-64 rounded-full" placeholder="搜索商品名称 / 分类 / SKU" />
          <Button class="rounded-full">新建商品</Button>
        </div>
      </template>

      <div class="rounded-2xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>商品名称</TableHead>
              <TableHead>分类</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>售价</TableHead>
              <TableHead>库存</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="item in products" :key="item.name">
              <TableCell class="font-medium">{{ item.name }}</TableCell>
              <TableCell>{{ item.category }}</TableCell>
              <TableCell>{{ item.status }}</TableCell>
              <TableCell>{{ item.price }}</TableCell>
              <TableCell>{{ item.stock }}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </PageSection>
  </div>
</template>

<script setup lang="ts">
import PageSection from '@/components/shared/page-section/index.vue'
import StatCard from '@/components/shared/stat-card/index.vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const metrics = [
  { label: '在售商品', value: '186', trend: '门店覆盖 18 家' },
  { label: '分类数量', value: '24', trend: '支持午市 / 晚市菜单' },
  { label: '套餐数量', value: '18', trend: '套餐联动营销活动' },
  { label: '售罄商品', value: '7', trend: '建议尽快补货' },
]

const products = [
  { name: '炙烤鸡腿饭', category: '主食', status: '上架中', price: '¥29.9', stock: '182' },
  { name: '黑椒牛肉意面', category: '西式', status: '上架中', price: '¥32.0', stock: '96' },
  { name: '双人分享套餐', category: '套餐', status: '活动中', price: '¥58.8', stock: '48' },
]
</script>
