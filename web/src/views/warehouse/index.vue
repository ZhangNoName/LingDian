<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Card } from '@lingdian/console-ui/card'
import { useLocale } from '@/i18n/locale'
import { merchantStore } from '@/auth/merchant-store'
import { warehouseSection } from '@/config/warehouse-navigation'
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
const view = computed(() => warehouseSection(route.query).view)

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
