<template>
  <header class="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border/70 px-4 py-3 md:px-6">
    <div class="flex min-w-0 flex-1 items-center gap-3">
      <Button
        variant="outline"
        size="icon-sm"
        class="md:hidden"
        :aria-label="english ? 'Open navigation' : '打开导航菜单'"
        aria-controls="merchant-mobile-navigation"
        :aria-expanded="mobileNavigationOpen"
        @click="$emit('open-mobile-navigation')"
      >
        <PanelLeft />
      </Button>
      <Button
        variant="outline"
        size="icon-sm"
        class="hidden md:inline-flex"
        :aria-label="sidebarLabel"
        :title="sidebarLabel"
        aria-controls="merchant-desktop-navigation"
        :aria-expanded="!sidebarCollapsed"
        @click="$emit('toggle-desktop-sidebar')"
      >
        <PanelLeft />
      </Button>
      <h1 class="text-xl font-semibold tracking-tight">{{ title }}</h1>
    </div>
    <LanguageSelect />
    <div v-if="$slots.default" class="flex w-full min-w-0 items-center justify-between gap-2 lg:w-auto">
      <slot />
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import LanguageSelect from '@/components/LanguageSelect.vue'
import { useLocale } from '@/i18n/locale'
import { PanelLeft } from '@lingdian/icons/web'
import { Button } from '@lingdian/console-ui/button'

const props = defineProps<{
  title: string
  sidebarCollapsed: boolean
  mobileNavigationOpen: boolean
}>()

defineEmits<{
  'toggle-desktop-sidebar': []
  'open-mobile-navigation': []
}>()

const { locale } = useLocale()
const english = computed(() => locale.value === 'en-US')
const sidebarLabel = computed(() => props.sidebarCollapsed
  ? (english.value ? 'Expand sidebar' : '展开侧栏')
  : (english.value ? 'Collapse sidebar' : '收起侧栏'))
</script>
