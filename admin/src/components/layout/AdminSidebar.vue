<script setup lang="ts">
import { Button } from '@lingdian/console-ui/button'
import { Collapsible } from '@lingdian/console-ui/collapsible'
import { DropdownMenu } from '@lingdian/console-ui/dropdown'
import { ArrowDown, Document, User, UserFilled } from '@lingdian/icons/admin'
import { computed, reactive, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { adminSession } from '../../auth/session'
import { visibleNavigationItems } from '../../config/navigation'

defineProps<{ collapsed?: boolean }>()
const emit = defineEmits<{ navigate: [] }>()
const route = useRoute()
const router = useRouter()
const items = computed(() => visibleNavigationItems(adminSession.currentUser.value?.roles ?? []))
const icons = { users: UserFilled, logs: Document, profile: User }
const expanded = reactive<Record<string, boolean>>({})

watch(() => route.path, (path) => {
  for (const item of items.value) {
    if (item.children?.some((child) => child.path === path)) expanded[item.path] = true
  }
}, { immediate: true })

function select(path: string) {
  void router.push(path)
  emit('navigate')
}
</script>

<template>
  <div class="admin-sidebar">
    <div class="brand" :class="{ compact: collapsed }">
      <span class="brand-mark">零</span>
      <div v-if="!collapsed"><strong>零点平台</strong><small>ADMIN CONSOLE</small></div>
    </div>
    <div v-if="!collapsed" class="nav-label">工作台</div>
    <nav class="sidebar-menu" :class="{ 'is-collapsed': collapsed }" aria-label="工作台">
      <template v-for="item in items" :key="item.path">
        <DropdownMenu
          v-if="item.children && collapsed"
          :items="item.children.map((child) => ({ value: child.path, label: child.label }))"
          side="right"
          align="start"
          @select="select"
        >
          <Button type="button" variant="ghost" class="sidebar-menu__item" :aria-label="item.label" :data-active="item.children.some((child) => child.path === route.path)">
            <component :is="icons[item.icon]" v-if="item.icon" />
          </Button>
        </DropdownMenu>
        <Collapsible
          v-else-if="item.children"
          :open="expanded[item.path] ?? false"
          @update:open="expanded[item.path] = $event"
        >
          <template #trigger>
            <Button type="button" variant="ghost" class="sidebar-menu__item sidebar-menu__group">
              <component :is="icons[item.icon]" v-if="item.icon" />
              <span>{{ item.label }}</span>
              <ArrowDown class="ml-auto transition-transform" :class="{ 'rotate-180': expanded[item.path] }" />
            </Button>
          </template>
          <div class="sidebar-menu__children">
            <Button v-for="child in item.children" :key="child.path" as-child variant="ghost" class="sidebar-menu__item">
              <RouterLink :to="child.path" @click="emit('navigate')">{{ child.label }}</RouterLink>
            </Button>
          </div>
        </Collapsible>
        <Button v-else as-child variant="ghost" class="sidebar-menu__item">
          <RouterLink :to="item.path" :aria-label="item.label" :title="collapsed ? item.label : undefined" @click="emit('navigate')">
            <component :is="icons[item.icon]" v-if="item.icon" />
            <span v-if="!collapsed">{{ item.label }}</span>
          </RouterLink>
        </Button>
      </template>
    </nav>
  </div>
</template>
