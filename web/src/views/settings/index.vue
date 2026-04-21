<template>
  <div class="grid gap-5">
    <div class="grid gap-4 md:grid-cols-2">
      <Card class="rounded-lg border-border/80">
        <CardContent class="p-5">
          <p class="text-sm text-muted-foreground">角色数量</p>
          <p class="mt-3 text-2xl font-semibold text-foreground">9</p>
          <p class="mt-2 text-xs text-muted-foreground">支持总部 / 店长 / 店员等角色</p>
        </CardContent>
      </Card>
      <Card class="rounded-lg border-border/80">
        <CardContent class="p-5">
          <p class="text-sm text-muted-foreground">打印设备在线</p>
          <p class="mt-3 text-2xl font-semibold text-foreground">26 / 29</p>
          <p class="mt-2 text-xs text-muted-foreground">3 台设备待检查</p>
        </CardContent>
      </Card>
    </div>

    <Card class="rounded-lg border-border/80">
      <CardHeader>
        <CardTitle class="text-xl">系统设置页面</CardTitle>
        <CardDescription class="mt-1 leading-6">管理账号、角色权限、设备、主题和操作日志。</CardDescription>
      </CardHeader>
      <CardContent>
        <div class="flex flex-wrap gap-2">
          <Badge variant="outline">账号列表</Badge>
          <Badge variant="outline">角色管理</Badge>
          <Badge variant="outline">权限配置</Badge>
          <Badge variant="outline">打印设备</Badge>
          <Badge variant="outline">消息通知</Badge>
          <Badge variant="outline">品牌主题</Badge>
          <Badge variant="outline">操作日志</Badge>
        </div>
      </CardContent>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { Badge } from '@/baseComponents/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/baseComponents/card'
</script>
