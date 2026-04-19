<template>
  <div class="grid gap-5">
    <div class="grid gap-4 md:grid-cols-2">
      <StatCard label="角色数量" value="9" trend="支持总部 / 店长 / 店员等角色" />
      <StatCard label="打印设备在线" value="26 / 29" trend="3 台设备待检查" />
    </div>

    <PageSection title="系统设置页面" description="管理账号、角色权限、设备、主题和操作日志。">
      <div class="flex flex-wrap gap-2">
        <Badge variant="outline">账号列表</Badge>
        <Badge variant="outline">角色管理</Badge>
        <Badge variant="outline">权限配置</Badge>
        <Badge variant="outline">打印设备</Badge>
        <Badge variant="outline">消息通知</Badge>
        <Badge variant="outline">品牌主题</Badge>
        <Badge variant="outline">操作日志</Badge>
      </div>
    </PageSection>
  </div>
</template>

<script setup lang="ts">
import PageSection from '@/components/shared/page-section/index.vue'
import StatCard from '@/components/shared/stat-card/index.vue'
import { Badge } from '@/components/ui/badge'
</script>
