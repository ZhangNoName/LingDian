<script setup lang="ts">
import { Document, User, UserFilled } from '@element-plus/icons-vue'
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { adminSession } from '../../auth/session'
import { visibleNavigationItems } from '../../config/navigation'
defineProps<{ collapsed?: boolean }>()
const emit = defineEmits<{ navigate: [] }>()
const route = useRoute(); const router = useRouter()
const items = computed(() => visibleNavigationItems(adminSession.currentUser.value?.roles ?? []))
const icons = { users: UserFilled, logs: Document, profile: User }
function select(path: string) { void router.push(path); emit('navigate') }
</script>

<template>
  <aside class="admin-sidebar">
    <div class="brand" :class="{ compact: collapsed }"><span class="brand-mark">零</span><div v-if="!collapsed"><strong>零点平台</strong><small>ADMIN CONSOLE</small></div></div>
    <div v-if="!collapsed" class="nav-label">工作台</div>
    <el-menu class="sidebar-menu" :default-active="route.path" :collapse="collapsed" @select="select">
      <template v-for="item in items" :key="item.path">
        <el-sub-menu v-if="item.children?.length" :index="item.path">
          <template #title>
            <el-icon v-if="item.icon"><component :is="icons[item.icon]" /></el-icon><span>{{ item.label }}</span>
          </template>
          <el-menu-item v-for="child in item.children" :key="child.path" :index="child.path">{{ child.label }}</el-menu-item>
        </el-sub-menu>
        <el-menu-item v-else :index="item.path">
          <el-icon v-if="item.icon"><component :is="icons[item.icon]" /></el-icon><template #title>{{ item.label }}</template>
        </el-menu-item>
      </template>
    </el-menu>
  </aside>
</template>
