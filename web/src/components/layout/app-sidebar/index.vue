<template>
  <aside
    :class="[
      'sticky top-0 hidden h-screen shrink-0 overflow-hidden border-r border-border/70 bg-card/95 py-4 backdrop-blur md:block',
      'transition-[width,padding] duration-200 ease-out will-change-[width]',
      collapsed ? 'w-24 px-3' : 'w-72 px-4',
    ]"
  >
    <div class="flex h-full flex-col">
      <div class="rounded-2xl border border-border bg-primary/5">
        <div
          :class="[
            'grid items-center overflow-hidden transition-[grid-template-columns,padding] duration-200 ease-out',
            collapsed ? 'grid-cols-[40px_0fr] px-2 py-3' : 'grid-cols-[40px_minmax(0,1fr)] px-3 py-3',
          ]"
        >
          <div class="flex size-10 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground">
            LD
          </div>
          <div
            :class="[
              'min-w-0 overflow-hidden pl-3 transition-[opacity,transform] duration-150 ease-out',
              collapsed ? 'pointer-events-none translate-x-1 opacity-0' : 'translate-x-0 opacity-100',
            ]"
          >
            <p class="truncate text-sm font-semibold text-foreground">零点管理后台</p>
            <p class="mt-1 truncate text-xs text-muted-foreground">shadcn-vue + Vite</p>
          </div>
        </div>
      </div>

      <Separator class="my-4" />

      <nav class="grid gap-1.5">
        <RouterLink
          v-for="item in navigationItems"
          :key="item.to"
          :to="item.to"
          :title="collapsed ? item.label : ''"
          class="group rounded-2xl border border-transparent transition-colors"
          active-class="bg-primary/8 border-primary/15"
        >
          <div
            :class="[
              'grid items-center overflow-hidden rounded-2xl transition-[grid-template-columns,padding] duration-200 ease-out',
              collapsed ? 'grid-cols-[24px_0fr] justify-center px-3 py-3.5' : 'grid-cols-[20px_minmax(0,1fr)] px-3 py-3',
            ]"
          >
            <component
              :is="item.icon"
              :class="[
                'shrink-0 text-muted-foreground transition-[color,width,height] duration-200 group-hover:text-primary',
                collapsed ? 'mx-auto size-5.5' : 'size-4',
              ]"
            />
            <div
              :class="[
                'min-w-0 overflow-hidden transition-[opacity,transform,padding] duration-150 ease-out',
                collapsed
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
import { RouterLink } from 'vue-router'
import { Separator } from '@/baseComponents/separator'
import { navigationItems } from '@/config/navigation'

defineProps<{
  collapsed: boolean
}>()
</script>
