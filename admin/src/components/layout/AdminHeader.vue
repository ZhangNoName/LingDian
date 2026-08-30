<script setup lang="ts">
import { Fold, User } from '@lingdian/icons/admin'
import { computed } from 'vue'
import { ElMessage } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'
import { adminSession } from '../../auth/session'
import ThemeSwitcher from './ThemeSwitcher.vue'
defineEmits<{ toggle: [] }>()
const route = useRoute(); const router = useRouter()
const title = computed(() => String(route.meta.title ?? '管理后台'))
async function command(value: string) {
  if (value !== 'logout') {
    await router.push(value)
    return
  }

  try {
    await adminSession.logout()
  } catch {
    ElMessage.error('服务端退出失败，本机登录状态已清除，请稍后重试。')
  } finally {
    await router.replace('/login')
  }
}
</script>

<template>
  <header class="admin-header">
    <div class="header-leading"><el-button text circle aria-label="收起侧栏" @click="$emit('toggle')"><el-icon><Fold /></el-icon></el-button><el-breadcrumb separator="/"><el-breadcrumb-item>零点平台</el-breadcrumb-item><el-breadcrumb-item>{{ title }}</el-breadcrumb-item></el-breadcrumb></div>
    <div class="header-actions"><ThemeSwitcher /><el-divider direction="vertical" /><el-dropdown @command="command"><button class="user-trigger"><span class="avatar"><el-icon><User /></el-icon></span><span class="user-copy"><strong>管理员</strong><small>{{ adminSession.currentUser.value?.roles.join(' / ') }}</small></span></button><template #dropdown><el-dropdown-menu><el-dropdown-item command="/profile">个人设置</el-dropdown-item><el-dropdown-item divided command="logout">退出登录</el-dropdown-item></el-dropdown-menu></template></el-dropdown></div>
  </header>
</template>
