<template>
  <div class="flex h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(22,119,255,0.12),_transparent_28%),linear-gradient(180deg,_#f5f7fa_0%,_#f7f9fc_100%)]">
    <AppSidebar :collapsed="navigation.isDesktopCollapsed.value" />

    <div class="min-w-0 flex flex-1 flex-col overflow-hidden">
      <AppHeader
        :title="pageTitle"
        :sidebar-collapsed="navigation.isDesktopCollapsed.value"
        :mobile-navigation-open="navigation.isMobileOpen.value"
        :store-count="storeCount"
        :user-label="userLabel"
        @open-mobile-navigation="navigation.openMobile"
        @toggle-desktop-sidebar="navigation.toggleDesktop"
      />
      <div class="flex justify-end gap-4 px-4 pt-3 text-sm font-medium text-primary md:px-6">
        <RouterLink :to="{ name: 'profile-nickname' }" class="hover:underline">设置昵称</RouterLink>
        <RouterLink :to="{ name: 'change-password' }" class="hover:underline">修改密码</RouterLink>
      </div>
      <main class="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-4 md:px-6 md:pb-8">
        <RouterView />
      </main>
    </div>

    <div
      v-if="navigation.isMobileOpen.value"
      id="merchant-mobile-navigation"
      class="fixed inset-0 z-50 md:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="商家导航"
    >
      <button class="absolute inset-0 bg-slate-950/45" type="button" aria-label="关闭导航菜单" @click="navigation.closeMobile" />
      <section class="relative h-full w-[min(18rem,calc(100vw-3rem))] overflow-hidden bg-card shadow-2xl">
        <div class="flex items-center justify-between border-b border-border px-4 py-3">
          <span class="text-sm font-semibold text-foreground">导航菜单</span>
          <Button variant="ghost" size="icon" aria-label="关闭导航菜单" @click="navigation.closeMobile">
            <X class="size-4" />
          </Button>
        </div>
        <div class="h-[calc(100%-3.5rem)] overflow-y-auto">
          <AppSidebar mobile :collapsed="false" @navigate="navigation.closeMobile" />
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, watch } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { X } from '@lingdian/icons/web'
import { merchantSession } from '@/auth/session'
import { Button } from '@/baseComponents/button'
import AppHeader from '@/components/layout/app-header/index.vue'
import AppSidebar from '@/components/layout/app-sidebar/index.vue'
import { createNavigationState } from './navigation-state'

const route = useRoute()
const navigation = createNavigationState()
const merchantUser = merchantSession.getUser()

const pageTitle = computed(() => String(route.meta.title ?? '零点管理后台'))
const storeCount = merchantUser?.merchantStoreIds?.length ?? 0
const userLabel = merchantUser ? `商家 ${merchantUser.userId.slice(-6)}` : '商家账号'

function handleEscape(event: KeyboardEvent) {
  if (event.key === 'Escape') navigation.closeMobile()
}

watch(() => route.fullPath, navigation.closeMobile)
onMounted(() => window.addEventListener('keydown', handleEscape))
onBeforeUnmount(() => window.removeEventListener('keydown', handleEscape))
</script>
