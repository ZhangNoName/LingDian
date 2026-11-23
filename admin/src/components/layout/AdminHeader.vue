<script setup lang="ts">
import { Button, IconButton } from '@lingdian/console-ui/button'
import { DialogTrigger } from '@lingdian/console-ui/dialog'
import { DropdownMenu } from '@lingdian/console-ui/dropdown'
import { Fold, User } from '@lingdian/icons/admin'
import { computed } from 'vue'
import { notifications } from '../ui/notifications'
import { useRoute, useRouter } from 'vue-router'
import { adminSession } from '../../auth/session'
import ThemeSwitcher from './ThemeSwitcher.vue'
defineProps<{ mobile: boolean; collapsed: boolean }>()
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
      <DialogTrigger v-if="mobile" as-child>
        <IconButton :icon="Fold" size="icon" label="打开工作台导航" />
      </DialogTrigger>
      <IconButton v-else :aria-expanded="!collapsed" aria-controls="platform-desktop-navigation" :icon="Fold" size="icon" :label="collapsed ? '展开侧栏' : '收起侧栏'" @click="$emit('toggle')" />
      <nav class="header-breadcrumb" aria-label="当前位置">
        <span class="header-breadcrumb-root">零点平台</span>
        <span class="header-breadcrumb-root" aria-hidden="true">/</span>
        <component :is="route.meta.layout === 'list' ? 'h1' : 'span'" aria-current="page">{{ title }}</component>
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
