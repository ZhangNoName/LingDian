<template>
  <div class="grid gap-5">
    <div class="grid gap-4 md:grid-cols-2">
      <Card class="border-border/80">
        <CardContent class="p-5">
          <p class="text-sm text-muted-foreground">会员总量</p>
          <p class="mt-3 text-2xl font-semibold text-foreground">42,680</p>
          <p class="mt-2 text-xs text-muted-foreground">本月新增 2,146</p>
        </CardContent>
      </Card>
      <Card class="border-border/80">
        <CardContent class="p-5">
          <p class="text-sm text-muted-foreground">本月复购率</p>
          <p class="mt-3 text-2xl font-semibold text-foreground">31.5%</p>
        </CardContent>
      </Card>
    </div>

    <Card class="border-border/80">
      <CardHeader>
        <CardTitle class="text-xl">推荐页面</CardTitle>
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
import { Badge } from '@lingdian/console-ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@lingdian/console-ui/card'
</script>
