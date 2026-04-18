<template>
  <div class="admin-shell" :class="{ 'sidebar-collapsed': isSidebarCollapsed }">
    <AppSidebar :collapsed="isSidebarCollapsed" />

    <div class="admin-main">
      <AppHeader
        :title="pageTitle"
        :sidebar-collapsed="isSidebarCollapsed"
        @toggle-sidebar="toggleSidebar"
      />
      <main class="admin-content">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import AppHeader from '../components/AppHeader.vue'
import AppSidebar from '../components/AppSidebar.vue'

const route = useRoute()
const isSidebarCollapsed = ref(false)

const pageTitle = computed(() => String(route.meta.title ?? '零点管理后台'))

function toggleSidebar() {
  isSidebarCollapsed.value = !isSidebarCollapsed.value
}
</script>
