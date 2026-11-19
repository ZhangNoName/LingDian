<script setup lang="ts">
import { Button } from '@lingdian/console-ui/button'
import { DropdownMenu } from '@lingdian/console-ui/dropdown'
import { Fold, User } from '@lingdian/icons/admin'
import { computed } from 'vue'
import { notifications } from '../ui/notifications'
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
    notifications.error('服务端退出失败，本机登录状态已清除，请稍后重试。')
  } finally {
    await router.replace('/login')
  }
}
</script>

<template>
  <header class="admin-header">
    <div class="header-leading">
      <Button type="button" variant="ghost" size="icon" aria-label="切换侧栏" @click="$emit('toggle')"><Fold /></Button>
      <nav class="header-breadcrumb" aria-label="当前位置">
        <span>零点平台</span>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{{ title }}</span>
      </nav>
    </div>
    <div class="header-actions">
      <ThemeSwitcher />
      <span class="h-5 border-l" aria-hidden="true" />
      <DropdownMenu :items="[{ value: '/profile', label: '个人设置' }, { value: 'logout', label: '退出登录', divided: true }]" @select="command">
        <Button type="button" variant="ghost" class="user-trigger" aria-label="管理员菜单">
          <span class="avatar"><User /></span>
          <span class="user-copy">
            <strong>管理员</strong><small>{{ adminSession.currentUser.value?.roles.join(' / ') }}</small>
          </span>
        </Button>
      </DropdownMenu>
    </div>
  </header>
</template>
