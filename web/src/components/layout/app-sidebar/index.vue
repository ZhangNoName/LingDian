<template>
  <aside
    :class="[
      'h-full min-h-0 flex-col bg-card p-3',
      mobile ? 'flex' : 'hidden shrink-0 border-r border-border/70 transition-[width] duration-200 md:flex',
      !mobile && (collapsed ? 'w-16' : 'w-56'),
    ]"
  >
    <div class="mb-3 flex h-9 shrink-0 items-center gap-2.5" :class="collapsed ? 'justify-center' : 'px-2'">
      <div class="grid size-8 shrink-0 place-items-center rounded-md bg-primary text-xs font-semibold text-primary-foreground" aria-hidden="true">LD</div>
      <span v-if="!collapsed" class="min-w-0 flex-1 truncate text-sm font-semibold">{{ english ? 'LingDian Console' : '零点管理后台' }}</span>
      <slot name="header-actions" />
    </div>

    <nav class="min-h-0 flex-1 space-y-1 overflow-y-auto" :aria-label="english ? 'Store navigation' : '商家导航'">
      <template v-for="item in navigationItems" :key="item.to">
        <WarehouseNavigation
          v-if="item.to === '/warehouse'"
          :label="item.label"
          :collapsed="collapsed"
          @expand="$emit('expand')"
          @navigate="$emit('navigate')"
        />
        <RouterLink
          v-else
          :to="item.to"
          :title="collapsed ? item.label : undefined"
          :aria-label="collapsed ? item.label : undefined"
          class="flex min-h-10 items-center gap-3 border border-transparent text-sm font-medium transition-colors hover:bg-muted"
          :class="collapsed ? 'justify-center' : 'px-3'"
          exact-active-class="border-primary/10 bg-primary/8 text-primary"
          @click="$emit('navigate')"
        >
          <component :is="item.icon" class="size-4 shrink-0" aria-hidden="true" />
          <span v-if="!collapsed" class="truncate">{{ item.label }}</span>
        </RouterLink>
      </template>
    </nav>

    <div class="mt-3 grid shrink-0 gap-1 border-t pt-3">
      <Button as-child variant="ghost" class="rounded-none" :size="collapsed ? 'icon' : 'default'" :class="!collapsed && 'w-full justify-start px-3'">
        <RouterLink :to="{ name: 'profile-nickname' }" :aria-label="profileLabel" :title="collapsed ? userLabel : profileLabel" @click="$emit('navigate')">
          <UserRound aria-hidden="true" />
          <span v-if="!collapsed" class="truncate">{{ userLabel }}</span>
        </RouterLink>
      </Button>
      <Button
        type="button"
        variant="ghost"
        class="rounded-none"
        :size="collapsed ? 'icon' : 'default'"
        :class="!collapsed && 'w-full justify-start px-3'"
        :aria-label="collapsed ? logoutLabel : undefined"
        :title="collapsed ? logoutLabel : undefined"
        :disabled="loggingOut"
        @click="$emit('logout')"
      >
        <LogOut aria-hidden="true" />
        <span v-if="!collapsed">{{ logoutLabel }}</span>
      </Button>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { Button } from '@lingdian/console-ui/button'
import { LogOut, UserRound } from '@lingdian/icons/web'
import { navigationItems as configuredNavigation } from '@/config/navigation'
import { useLocale } from '@/i18n/locale'
import WarehouseNavigation from './WarehouseNavigation.vue'

const props = withDefaults(defineProps<{
  collapsed: boolean
  mobile?: boolean
  userLabel: string
  loggingOut: boolean
}>(), { mobile: false })

defineEmits<{ navigate: []; logout: []; expand: [] }>()

const { locale } = useLocale()
const english = computed(() => locale.value === 'en-US')
const englishLabels: Record<string, string> = {
  '/': 'Overview',
  '/stores': 'Store settings',
  '/products': 'Products & menu',
  '/orders': 'Orders',
  '/warehouse': 'Inventory',
  '/settings': 'Settings',
  '/members': 'Members',
  '/marketing': 'Marketing',
  '/analytics': 'Analytics',
  '/finance': 'Finance',
}
const navigationItems = computed(() => configuredNavigation.map((item) => ({
  ...item,
  label: english.value ? (englishLabels[item.to] ?? item.label) : item.label,
})))
const profileLabel = computed(() => english.value ? 'Profile' : '个人资料')
const logoutLabel = computed(() => english.value
  ? (props.loggingOut ? 'Signing out…' : 'Sign out')
  : (props.loggingOut ? '退出中…' : '退出登录'))
</script>
