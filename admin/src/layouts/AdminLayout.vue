<script setup lang="ts">
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@lingdian/console-ui/dialog'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import AdminHeader from '../components/layout/AdminHeader.vue'
import AdminSidebar from '../components/layout/AdminSidebar.vue'

const route = useRoute()
const collapsed = ref(false)
const mobile = ref(false)
const drawer = ref(false)
const contentClass = computed(() => route.meta.layout === 'list' ? 'route-content--list' : 'route-content--scroll')

function resize() {
  mobile.value = window.innerWidth < 768
  if (mobile.value) collapsed.value = false
  else drawer.value = false
}

onMounted(() => {
  resize()
  window.addEventListener('resize', resize)
})
onBeforeUnmount(() => window.removeEventListener('resize', resize))
</script>

<template>
  <div class="admin-shell">
    <aside v-if="!mobile" id="platform-desktop-navigation" class="admin-shell__sidebar" :class="{ 'is-collapsed': collapsed }">
      <AdminSidebar :collapsed="collapsed" />
    </aside>
    <Dialog v-model:open="drawer">
      <DialogContent side="left" class="w-[min(16rem,calc(100vw-3rem))] p-0">
        <DialogTitle class="sr-only">工作台导航</DialogTitle>
        <DialogDescription class="sr-only">选择管理页面</DialogDescription>
        <AdminSidebar @navigate="drawer = false" />
      </DialogContent>
      <div class="admin-shell__main">
        <AdminHeader :mobile="mobile" :collapsed="collapsed" @toggle="collapsed = !collapsed" />
        <main><div class="route-content" :class="contentClass"><RouterView /></div></main>
      </div>
    </Dialog>
  </div>
</template>
