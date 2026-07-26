<script setup lang="ts">
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
}

function toggle() {
  if (mobile.value) drawer.value = true
  else collapsed.value = !collapsed.value
}

onMounted(() => {
  resize()
  window.addEventListener('resize', resize)
})
onBeforeUnmount(() => window.removeEventListener('resize', resize))
</script>

<template>
  <el-container class="admin-shell">
    <el-aside v-if="!mobile" :width="collapsed ? '72px' : '240px'"><AdminSidebar :collapsed="collapsed" /></el-aside>
    <el-drawer v-model="drawer" direction="ltr" size="240px" :with-header="false"><AdminSidebar @navigate="drawer = false" /></el-drawer>
    <el-container class="admin-shell__main">
      <el-header><AdminHeader @toggle="toggle" /></el-header>
      <el-main><div class="route-content" :class="contentClass"><router-view /></div></el-main>
    </el-container>
  </el-container>
</template>
