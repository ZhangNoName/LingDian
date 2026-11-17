<template>
  <aside
    :class="[
      mobile
        ? 'block h-full w-full overflow-y-auto bg-card px-4 py-4'
        : 'sticky top-0 hidden h-screen shrink-0 overflow-hidden border-r border-border/70 bg-card/95 px-4 py-4 backdrop-blur md:block',
      'transition-[width,padding] duration-200 ease-out will-change-[width]',
      !mobile && collapsed ? 'w-24 px-3' : !mobile ? 'w-72 px-4' : '',
    ]"
  >
    <div class="flex h-full flex-col">
      <div class="rounded-2xl border border-border bg-primary/5">
        <div
          :class="[
            'grid items-center overflow-hidden transition-[grid-template-columns,padding] duration-200 ease-out',
            !mobile && collapsed ? 'grid-cols-[40px_0fr] px-2 py-3' : 'grid-cols-[40px_minmax(0,1fr)] px-3 py-3',
          ]"
        >
          <div class="flex size-10 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground">
            LD
          </div>
          <div
            :class="[
              'min-w-0 overflow-hidden pl-3 transition-[opacity,transform] duration-150 ease-out',
              !mobile && collapsed ? 'pointer-events-none translate-x-1 opacity-0' : 'translate-x-0 opacity-100',
            ]"
          >
            <p class="truncate text-sm font-semibold text-foreground">{{ locale === 'en-US' ? 'LingDian Console' : '零点管理后台' }}</p>
            <p class="mt-1 truncate text-xs text-muted-foreground">{{ locale === 'en-US' ? 'Store operations' : '门店经营工作台' }}</p>
          </div>
        </div>
      </div>

      <Separator class="my-4" />

      <nav class="grid gap-1.5">
        <RouterLink
          v-for="item in navigationItems"
          :key="item.to"
          :to="item.to"
          :title="!mobile && collapsed ? item.label : ''"
          class="group rounded-2xl border border-transparent transition-colors"
          exact-active-class="bg-primary/8 border-primary/15"
          @click="$emit('navigate')"
        >
          <div
            :class="[
              'grid items-center overflow-hidden rounded-2xl transition-[grid-template-columns,padding] duration-200 ease-out',
              !mobile && collapsed ? 'grid-cols-[24px_0fr] justify-center px-3 py-3.5' : 'grid-cols-[20px_minmax(0,1fr)] px-3 py-3',
            ]"
          >
            <component
              :is="item.icon"
              :class="[
                'shrink-0 text-muted-foreground transition-[color,width,height] duration-200 group-hover:text-primary',
                !mobile && collapsed ? 'mx-auto size-5.5' : 'size-4',
              ]"
            />
            <div
              :class="[
                'min-w-0 overflow-hidden transition-[opacity,transform,padding] duration-150 ease-out',
                !mobile && collapsed
                  ? 'pointer-events-none translate-x-1 opacity-0 pl-0'
                  : 'translate-x-0 opacity-100 pl-3',
              ]"
            >
              <p class="truncate text-sm font-medium text-foreground">{{ item.label }}</p>
              <p class="mt-1 truncate text-xs text-muted-foreground">{{ item.caption }}</p>
            </div>
          </div>
        </RouterLink>
      </nav>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { Separator } from '@/baseComponents/separator'
import { navigationItems as configuredNavigation } from '@/config/navigation'
import { useLocale } from '@/i18n/locale'

const { locale } = useLocale()
const english: Record<string, [string, string]> = {
  '/': ['Overview', 'Modules and quick actions'],
  '/stores': ['Store settings', 'Store information and opening status'],
  '/products': ['Products & menu', 'Products, categories and variants'],
  '/orders': ['Orders', 'Order search and status history'],
  '/warehouse': ['Inventory', 'Materials, alerts and movements'],
  '/settings': ['Settings', 'Account and integrations'],
}
const navigationItems = computed(() => configuredNavigation.map((item) => {
  const translated = locale.value === 'en-US' ? english[item.to] : undefined
  return translated ? { ...item, label: translated[0], caption: translated[1] } : item
}))

withDefaults(defineProps<{
  collapsed: boolean
  mobile?: boolean
}>(), {
  mobile: false,
})

defineEmits<{
  (event: 'navigate'): void
}>()
</script>
