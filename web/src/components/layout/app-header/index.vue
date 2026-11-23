<template>
  <header class="flex min-h-(--console-header-height) flex-wrap items-center gap-x-4 gap-y-2 border-b bg-card px-(--console-gutter) py-2.5">
    <div class="flex min-w-0 flex-1 items-center gap-2.5">
      <DialogTrigger as-child>
        <IconButton
          :icon="PanelLeft"
          variant="ghost"
          class="md:hidden"
          :label="english ? 'Open navigation' : '打开导航菜单'"
        />
      </DialogTrigger>
      <IconButton
        :icon="PanelLeft"
        variant="ghost"
        class="hidden md:inline-flex"
        :label="sidebarLabel"
        aria-controls="merchant-desktop-navigation"
        :aria-expanded="!sidebarCollapsed"
        @click="$emit('toggle-desktop-sidebar')"
      />
      <h1 class="min-w-0 text-lg font-semibold tracking-tight sm:text-xl">{{ title }}</h1>
    </div>
    <LanguageSelect />
    <div v-if="$slots.default" class="flex w-full min-w-0 items-center justify-between gap-2 sm:w-auto sm:gap-3 sm:border-l sm:pl-4">
      <slot />
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import LanguageSelect from '@/components/LanguageSelect.vue'
import { useLocale } from '@/i18n/locale'
import { PanelLeft } from '@lingdian/icons/web'
import { DialogTrigger } from '@lingdian/console-ui/dialog'
import { IconButton } from '@lingdian/console-ui/button'

const props = defineProps<{
  title: string
  sidebarCollapsed: boolean
}>()

defineEmits<{
  'toggle-desktop-sidebar': []
}>()

const { locale } = useLocale()
const english = computed(() => locale.value === 'en-US')
const sidebarLabel = computed(() => props.sidebarCollapsed
  ? (english.value ? 'Expand sidebar' : '展开侧栏')
  : (english.value ? 'Collapse sidebar' : '收起侧栏'))
</script>
