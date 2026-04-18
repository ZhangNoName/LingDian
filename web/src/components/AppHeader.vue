<template>
  <header class="topbar">
    <div class="topbar-leading">
      <button
        class="sidebar-toggle"
        type="button"
        :aria-label="sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'"
        @click="$emit('toggle-sidebar')"
      >
        <span></span>
        <span></span>
        <span></span>
      </button>

      <div>
        <p class="topbar-kicker">LingDian Web Console</p>
        <h1 class="topbar-title">{{ title }}</h1>
      </div>
    </div>

    <div class="topbar-actions">
      <div class="topbar-chip">
        <span class="topbar-dot"></span>
        今日营业 18 家门店
      </div>
      <div class="topbar-user">运营管理员</div>
    </div>
  </header>
</template>

<script setup lang="ts">
defineEmits<{
  (event: 'toggle-sidebar'): void
}>()

defineProps<{
  title: string
  sidebarCollapsed: boolean
}>()
</script>
