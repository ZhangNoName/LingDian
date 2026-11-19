<template>
  <div class="flex h-dvh overflow-hidden bg-background">
    <AppSidebar
      id="merchant-desktop-navigation"
      :collapsed="navigation.isDesktopCollapsed.value"
      :user-label="userLabel"
      :logging-out="loggingOut"
      @logout="logout"
      @expand="navigation.toggleDesktop"
    />

    <div class="min-w-0 flex flex-1 flex-col overflow-hidden">
      <AppHeader
        :title="pageTitle"
        :sidebar-collapsed="navigation.isDesktopCollapsed.value"
        :mobile-navigation-open="navigation.isMobileOpen.value"
        @open-mobile-navigation="navigation.openMobile"
        @toggle-desktop-sidebar="navigation.toggleDesktop"
      >
        <template v-if="merchantStore.stores.value.length" #default>
          <SelectField
            :model-value="merchantStore.selectedId.value"
            class="min-w-0 max-w-48 md:max-w-60"
            :aria-label="locale === 'en-US' ? 'Store' : '当前门店'"
            @update:model-value="changeStore"
            :options="[
              { value: '', label: locale === 'en-US' ? 'Select a store' : '请选择门店', disabled: true },
              ...merchantStore.stores.value.map((store) => ({ value: store.id, label: store.name })),
            ]"
          />
          <InventoryAlertNotice v-if="storeReady" :key="merchantStore.selectedId.value" :store-id="merchantStore.selectedId.value" />
        </template>
      </AppHeader>
      <main class="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-4 md:px-6 md:pb-8">
        <div v-if="!storeReady && !accountPage" class="border bg-card p-8 text-sm" role="status">
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
      <Button type="button" variant="ghost" class="absolute inset-0 h-full w-full rounded-none bg-slate-950/45 p-0 hover:bg-slate-950/45" tabindex="-1" aria-hidden="true" @click="navigation.closeMobile" />
      <section class="relative flex h-full w-[min(16rem,calc(100vw-3rem))] flex-col overflow-hidden bg-card shadow-2xl">
        <AppSidebar
          mobile
          class="min-h-0 flex-1"
          :collapsed="false"
          :user-label="userLabel"
          :logging-out="loggingOut"
          @navigate="navigation.closeMobile"
          @logout="logout"
        >
          <template #header-actions>
            <Button variant="ghost" size="icon-sm" :aria-label="locale === 'en-US' ? 'Close navigation' : '关闭导航菜单'" @click="navigation.closeMobile">
              <X class="size-4" />
            </Button>
          </template>
        </AppSidebar>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import InventoryAlertNotice from '@/components/layout/InventoryAlertNotice.vue'
import { computed, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import { X } from '@lingdian/icons/web'
import { merchantStore } from '@/auth/merchant-store'
import { listMerchantStores } from '@/services/integrations'
import { merchantSession } from '@/auth/session'
import { Button } from '@lingdian/console-ui/button'
import { SelectField } from '@lingdian/console-ui/select'
import AppHeader from '@/components/layout/app-header/index.vue'
import AppSidebar from '@/components/layout/app-sidebar/index.vue'
import { createNavigationState } from './navigation-state'
import {pageTitle as localizedPageTitle} from '@/i18n/page-titles'
import { useLocale } from '@/i18n/locale'
import { warehouseViewLockKey } from '@/config/warehouse-view-lock'

const route = useRoute()
const router = useRouter()
const navigation = createNavigationState()
provide(warehouseViewLockKey, ref(false))
const merchantUser = merchantSession.getUser()
const loggingOut = ref(false)
const loadingStores = ref(true)
const storeLoadError = ref(false)
const accountPage = computed(() => ['change-password', 'profile-nickname'].includes(String(route.name)))
const storeReady = computed(() => !loadingStores.value && !storeLoadError.value && !!merchantStore.selectedId.value)

const { locale } = useLocale()
const pageTitle = computed(() => localizedPageTitle(route.name, locale.value, route.query))
const userLabel = computed(() => merchantUser ? `${locale.value === 'en-US' ? 'Merchant' : '商家'} ${merchantUser.userId.slice(-6)}` : locale.value === 'en-US' ? 'Merchant' : '商家账号')

async function loadStores() {
  loadingStores.value = true
  storeLoadError.value = false
  try { merchantStore.setStores(await listMerchantStores()) }
  catch { storeLoadError.value = true }
  finally { loadingStores.value = false }
}
async function changeStore(id: string) {
  if (route.name === 'orders' && route.query.orderId) await router.replace({ query: { ...route.query, orderId: undefined } })
  if (route.name === 'products' && route.query.productId) await router.replace({ query: { ...route.query, productId: undefined } })
  if (route.name === 'warehouse') {
    const query = { ...route.query }
    for (const key of ['materialId', 'alertId', 'stocktakeId', 'purchaseId', 'pendingItemId', 'replenishmentItemId', 'receiptItemId', 'receiptSupplierId', 'itemId', 'analysisItem', 'trendItem', 'trendStartAt', 'trendEndAt', 'trendDay', 'trendPage']) delete query[key]
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
