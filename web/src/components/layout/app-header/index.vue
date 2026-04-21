<template>
  <header class="sticky top-0 z-20 border-b border-border/70 bg-background/85 px-4 py-4 backdrop-blur md:px-6">
    <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div class="flex items-start gap-3">
        <Button variant="outline" size="icon" class="size-10 rounded-xl" @click="$emit('toggle-sidebar')">
          <PanelLeft class="size-4" />
        </Button>

        <div>
          <p class="text-xs font-semibold uppercase tracking-[0.24em] text-primary">LingDian Console</p>
          <h1 class="mt-2 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            {{ title }}
          </h1>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <Badge variant="secondary" class="rounded-full px-3 py-1 text-xs">
          <span class="mr-1 inline-block size-2 rounded-full bg-emerald-500"></span>
          今日营业 18 家门店
        </Badge>
        <Badge variant="outline" class="rounded-full px-3 py-1 text-xs text-muted-foreground">
          {{ sidebarCollapsed ? '侧栏已收起' : '侧栏已展开' }}
        </Badge>
        <Button variant="outline" size="sm" class="rounded-full">运营管理员</Button>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { PanelLeft } from 'lucide-vue-next'
import { Badge } from '@/baseComponents/badge'
import { Button } from '@/baseComponents/button'

defineEmits<{
  (event: 'toggle-sidebar'): void
}>()

defineProps<{
  title: string
  sidebarCollapsed: boolean
}>()
</script>
