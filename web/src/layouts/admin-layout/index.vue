<template>
  <div class="flex h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(22,119,255,0.12),_transparent_28%),linear-gradient(180deg,_#f5f7fa_0%,_#f7f9fc_100%)]">
    <AppSidebar :collapsed="isSidebarCollapsed" />

    <div class="min-w-0 flex flex-1 flex-col overflow-hidden">
      <AppHeader
        :title="pageTitle"
        :sidebar-collapsed="isSidebarCollapsed"
        @toggle-sidebar="toggleSidebar"
      />
      <main class="min-h-0 flex-1 overflow-hidden px-4 pb-6 pt-4 md:px-6 md:pb-8">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import AppHeader from '@/components/layout/app-header/index.vue'
import AppSidebar from '@/components/layout/app-sidebar/index.vue'

const route = useRoute()
const isSidebarCollapsed = ref(false)

const pageTitle = computed(() => String(route.meta.title ?? '零点管理后台'))

function toggleSidebar() {
  isSidebarCollapsed.value = !isSidebarCollapsed.value
}
</script>
