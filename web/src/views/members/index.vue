<template>
  <div class="grid gap-5">
    <div class="grid gap-4 md:grid-cols-2">
      <Card class="rounded-lg border-border/80">
        <CardContent class="p-5">
          <p class="text-sm text-muted-foreground">会员总量</p>
          <p class="mt-3 text-2xl font-semibold text-foreground">42,680</p>
          <p class="mt-2 text-xs text-muted-foreground">本月新增 2,146</p>
        </CardContent>
      </Card>
      <Card class="rounded-lg border-border/80">
        <CardContent class="p-5">
          <p class="text-sm text-muted-foreground">本月复购率</p>
          <p class="mt-3 text-2xl font-semibold text-foreground">31.5%</p>
          <p class="mt-2 text-xs text-muted-foreground">会员贡献持续提升</p>
        </CardContent>
      </Card>
    </div>

    <Card class="rounded-lg border-border/80">
      <CardHeader>
        <CardTitle class="text-xl">推荐页面</CardTitle>
        <CardDescription class="mt-1 leading-6">用户与会员模块建议拆成以下独立页面。</CardDescription>
      </CardHeader>
      <CardContent>
        <div class="flex flex-wrap gap-2">
          <Badge variant="outline">用户列表</Badge>
          <Badge variant="outline">用户详情</Badge>
          <Badge variant="outline">会员等级</Badge>
          <Badge variant="outline">积分记录</Badge>
          <Badge variant="outline">优惠券记录</Badge>
          <Badge variant="outline">用户标签</Badge>
        </div>
      </CardContent>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { Badge } from '@/baseComponents/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/baseComponents/card'
</script>
