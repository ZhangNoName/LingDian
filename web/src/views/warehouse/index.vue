<script setup lang="ts">
import { computed, inject } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { Button } from '@lingdian/console-ui/button'
import { Card } from '@lingdian/console-ui/card'
import { useLocale } from '@/i18n/locale'
import { merchantStore } from '@/auth/merchant-store'
import { warehouseGroup, warehouseSection, warehouseSectionTarget } from '@/config/warehouse-navigation'
import { warehouseViewLockKey } from '@/config/warehouse-view-lock'
import Purchasing from './purchasing/index.vue'
import Stocktakes from './stocktakes/index.vue'
import { replenishmentFocus } from './purchasing/replenishment-state'
import InventoryHolds from './InventoryHolds.vue'
import InventoryAlerts from './InventoryAlerts.vue'
import InventoryActivity from './InventoryActivity.vue'
import InventoryRecipes from './InventoryRecipes.vue'
import StockList from './materials/StockList.vue'
import { parseStockState, stockTarget } from './materials/state'
const { locale } = useLocale(),
  route = useRoute(),
  router = useRouter()
const storeId = merchantStore.selectedId
const storeName = computed(
  () => merchantStore.stores.value.find((store) => store.id === storeId.value)?.name ?? '',
)
const activeSection = computed(() => warehouseSection(route.query))
const view = computed(() => activeSection.value.view)
const group = computed(() => warehouseGroup(activeSection.value))
const viewLock = inject(warehouseViewLockKey)

function isLocked(section: ReturnType<typeof warehouseSection>) {
  return section !== activeSection.value && section.view === view.value && !!viewLock?.value
}

function replenish(itemId: string) {
  void router.push({ query: { ...route.query, ...replenishmentFocus(itemId) } })
}
function stockFromAlert(itemId: string, lifecycle: 'ACTIVE' | 'ARCHIVED') {
  const state = { ...parseStockState(route.query), lifecycle }
  void router.push({ query: { ...stockTarget(route.query, state, itemId), view: 'inventory' } })
}
</script>
<template>
  <section class="min-w-0" :lang="locale">
    <Card class="min-w-0 gap-0 p-0">
      <nav v-if="group.sections.length > 1" :aria-label="group.label[locale]" class="border-b px-3 py-2 sm:px-4">
        <ul class="flex flex-wrap gap-1">
          <li v-for="section in group.sections" :key="section.view + (section.subview ?? '')">
            <RouterLink
              :to="section === activeSection ? route.fullPath : warehouseSectionTarget(section, route.query)"
              custom
              v-slot="{ href, navigate }"
            >
              <Button
                as-child
                variant="ghost"
                size="sm"
                class="h-auto min-h-9 whitespace-normal text-start aria-[current=page]:bg-sidebar-accent aria-[current=page]:font-semibold aria-[current=page]:text-sidebar-primary aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
              >
                <a
                  :href="isLocked(section) ? undefined : href"
                  :role="isLocked(section) ? 'link' : undefined"
                  :aria-disabled="isLocked(section) || undefined"
                  :aria-current="section === activeSection ? 'page' : undefined"
                  @click="!isLocked(section) && navigate($event)"
                >{{ section.label[locale] }}</a>
              </Button>
            </RouterLink>
          </li>
        </ul>
      </nav>
      <InventoryAlerts
        v-if="view === 'alerts'"
        :store-id="storeId"
        :store-name="storeName"
        @stock="stockFromAlert"
        @replenish="replenish"
      />
      <Stocktakes v-else-if="view === 'stocktakes'" :store-id="storeId" :store-name="storeName" />
      <Purchasing v-else-if="view === 'purchases'" :store-id="storeId" :store-name="storeName" />
      <InventoryHolds v-else-if="view === 'holds'" :store-id="storeId" />
      <InventoryRecipes v-else-if="view === 'recipes'" :store-id="storeId" />
      <InventoryActivity
        v-else-if="view === 'history' || view === 'report'"
        :key="`${storeId}:${view}`"
        :store-id="storeId"
        :store-name="storeName"
        :mode="view"
      />
      <StockList v-else :store-id="storeId" :store-name="storeName" @replenish="replenish" />
    </Card>
  </section>
</template>
