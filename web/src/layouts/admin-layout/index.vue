<template>
  <div class="flex h-screen overflow-hidden bg-background">
    <AppSidebar :collapsed="navigation.isDesktopCollapsed.value" />

    <div class="min-w-0 flex flex-1 flex-col overflow-hidden">
      <AppHeader
        :title="pageTitle"
        :sidebar-collapsed="navigation.isDesktopCollapsed.value"
        :mobile-navigation-open="navigation.isMobileOpen.value"
        :store-count="storeCount"
        :user-label="userLabel"
        :logging-out="loggingOut"
        @open-mobile-navigation="navigation.openMobile"
        @toggle-desktop-sidebar="navigation.toggleDesktop"
        @logout="logout"
      />
      <div class="flex flex-wrap items-center justify-between gap-3 px-4 pt-3 text-sm md:px-6">
        <label v-if="merchantStore.stores.value.length" class="flex min-w-0 items-center gap-2">
          <span class="shrink-0 text-muted-foreground">{{ locale === 'en-US' ? 'Store' : '当前门店' }}</span>
          <select :value="merchantStore.selectedId.value" class="max-w-60 rounded-md border bg-card px-3 py-2" :aria-label="locale === 'en-US' ? 'Store' : '当前门店'" @change="changeStore">
            <option disabled value="">{{ locale === 'en-US' ? 'Select a store' : '请选择门店' }}</option>
            <option v-for="store in merchantStore.stores.value" :key="store.id" :value="store.id">{{ store.name }}</option>
          </select>
        </label>
        <InventoryAlertNotice v-if="storeReady" :key="merchantStore.selectedId.value" :store-id="merchantStore.selectedId.value" />

      </div>
      <main class="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-4 md:px-6 md:pb-8">
        <div v-if="!storeReady && !accountPage" class="rounded-lg border bg-card p-8 text-sm" role="status">
          <p>{{ storeLoadError ? (locale === 'en-US' ? 'Could not load authorized stores.' : '无法加载授权门店，请重试。') : loadingStores ? (locale === 'en-US' ? 'Loading stores…' : '正在加载门店…') : (locale === 'en-US' ? 'Select an authorized store to continue.' : '请选择已授权门店后继续。') }}</p>
          <Button v-if="storeLoadError" variant="outline" class="mt-3" @click="loadStores">{{ locale === 'en-US' ? 'Retry' : '重试' }}</Button>
        </div>
        <RouterView v-else :key="merchantStore.selectedId.value" />
      </main>
    </div>

    <div
      v-if="navigation.isMobileOpen.value"
      id="merchant-mobile-navigation"
      class="fixed inset-0 z-50 md:hidden"
      role="dialog"
      aria-modal="true"
      :aria-label="locale === 'en-US' ? 'Store navigation' : '商家导航'"
    >
      <button class="absolute inset-0 bg-slate-950/45" type="button" :aria-label="locale === 'en-US' ? 'Close navigation' : '关闭导航菜单'" @click="navigation.closeMobile" />
      <section class="relative h-full w-[min(18rem,calc(100vw-3rem))] overflow-hidden bg-card shadow-2xl">
        <div class="flex items-center justify-between border-b border-border px-4 py-3">
          <span class="text-sm font-semibold text-foreground">{{ locale === 'en-US' ? 'Navigation' : '导航菜单' }}</span>
          <Button variant="ghost" size="icon" :aria-label="locale === 'en-US' ? 'Close navigation' : '关闭导航菜单'" @click="navigation.closeMobile">
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
import InventoryAlertNotice from '@/components/layout/InventoryAlertNotice.vue'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import { X } from '@lingdian/icons/web'
import { merchantStore } from '@/auth/merchant-store'
import { listMerchantStores } from '@/services/integrations'
import { merchantSession } from '@/auth/session'
import { Button } from '@/baseComponents/button'
import AppHeader from '@/components/layout/app-header/index.vue'
import AppSidebar from '@/components/layout/app-sidebar/index.vue'
import { createNavigationState } from './navigation-state'
import {pageTitle as localizedPageTitle} from '@/i18n/page-titles'
import { useLocale } from '@/i18n/locale'

const route = useRoute()
const router = useRouter()
const navigation = createNavigationState()
const merchantUser = merchantSession.getUser()
const loggingOut = ref(false)
const loadingStores = ref(true)
const storeLoadError = ref(false)
const accountPage = computed(() => ['change-password', 'profile-nickname'].includes(String(route.name)))
const storeReady = computed(() => !loadingStores.value && !storeLoadError.value && !!merchantStore.selectedId.value)

const { locale } = useLocale()
const pageTitle = computed(() => localizedPageTitle(route.name,locale.value))
const storeCount = computed(() => merchantStore.stores.value.length)
const userLabel = computed(() => merchantUser ? `${locale.value === 'en-US' ? 'Merchant' : '商家'} ${merchantUser.userId.slice(-6)}` : locale.value === 'en-US' ? 'Merchant' : '商家账号')

async function loadStores() {
  loadingStores.value = true
  storeLoadError.value = false
  try { merchantStore.setStores(await listMerchantStores()) }
  catch { storeLoadError.value = true }
  finally { loadingStores.value = false }
}
async function changeStore(event: Event) {
  const id = (event.target as HTMLSelectElement).value
  if (route.name === 'orders' && route.query.orderId) await router.replace({ query: { ...route.query, orderId: undefined } })
  if (route.name === 'products' && route.query.productId) await router.replace({ query: { ...route.query, productId: undefined } })
  if (route.name === 'warehouse') {
    const query = { ...route.query }
    for (const key of ['stocktakeId', 'purchaseId', 'pendingItemId', 'replenishmentItemId', 'receiptItemId', 'receiptSupplierId', 'itemId']) delete query[key]
    if (Object.keys(query).length !== Object.keys(route.query).length) await router.replace({ query })
  }
  merchantStore.select(id)
  navigation.closeMobile()
}

function handleEscape(event: KeyboardEvent) {
  if (event.key === 'Escape') navigation.closeMobile()
}

async function logout() {
  if (loggingOut.value) return
  loggingOut.value = true
  try {
    await merchantSession.logout()
  } catch {
    await router.replace({name:'login',query:{notice:'logout-unconfirmed'}})
    return
  } finally {
    loggingOut.value = false
    if(router.currentRoute.value.name!=='login')await router.replace({ name: 'login' })
  }
}

watch(() => route.fullPath, navigation.closeMobile)
onMounted(() => { window.addEventListener('keydown', handleEscape); void loadStores() })
onBeforeUnmount(() => window.removeEventListener('keydown', handleEscape))
</script>
