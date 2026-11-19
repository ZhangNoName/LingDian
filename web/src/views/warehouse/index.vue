<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Button } from '@lingdian/console-ui/button'
import { Card } from '@lingdian/console-ui/card'
import { useLocale } from '@/i18n/locale'
import { merchantStore } from '@/auth/merchant-store'
import Purchasing from './purchasing/index.vue'
import Stocktakes from './stocktakes/index.vue'
import { replenishmentFocus } from './purchasing/replenishment-state'
import InventoryHolds from './InventoryHolds.vue'
import InventoryAlerts from './InventoryAlerts.vue'
import InventoryActivity from './InventoryActivity.vue'
import InventoryRecipes from './InventoryRecipes.vue'
import StockList from './materials/StockList.vue'
import { parseStockState, stockTarget } from './materials/state'
import { en, zh, type MessageKey } from './messages'
const { locale } = useLocale(),
  route = useRoute(),
  router = useRouter()
const t = (key: MessageKey) => (locale.value === 'en-US' ? en : zh)[key]
const storeId = merchantStore.selectedId
const storeName = computed(
  () => merchantStore.stores.value.find((store) => store.id === storeId.value)?.name ?? '',
)
const view = computed(() =>
  route.query.view === 'stocktakes'
    ? 'stocktakes'
    : route.query.view === 'purchases'
      ? 'purchases'
      : route.query.view === 'holds'
        ? 'holds'
        : route.query.view === 'alerts'
          ? 'alerts'
          : route.query.view === 'recipes'
            ? 'recipes'
            : route.query.view === 'report'
              ? 'report'
              : route.query.view === 'history'
                ? 'history'
                : 'inventory',
)
function switchView(value: string) {
  void router.push({
    query: {
      ...route.query,
      view: value,
      page: undefined,
      itemId: undefined,
      purchaseId: undefined,
      stocktakeId: undefined,
      alertId: undefined,
      materialId: undefined,
      ...(route.query.reportView === 'trend' ? { reportView: undefined } : {}),
      trendItem: undefined,
      trendStartAt: undefined,
      trendEndAt: undefined,
      trendDay: undefined,
      trendPage: undefined,
    },
  })
}
function showHistory() {
  switchView('history')
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
  <section class="inventory-page" :lang="locale">
    <div>
      <p class="text-sm text-muted-foreground">{{ t('subtitle') }}</p>
      <p v-if="storeName" class="mt-1 text-sm font-medium">{{ storeName }}</p>
    </div>
    <Card class="min-w-0 gap-0 p-0">
      <div class="flex flex-wrap items-center justify-between gap-3 border-b p-4">
        <div
          class="flex max-w-full flex-nowrap gap-1 overflow-x-auto [&>button]:shrink-0"
          :aria-label="t('title')"
        >
          <Button
            :variant="view === 'inventory' ? 'secondary' : 'ghost'"
            :aria-pressed="view === 'inventory'"
            @click="switchView('inventory')"
            >{{ t('inventory') }}</Button
          >
          <Button
            :variant="view === 'stocktakes' ? 'secondary' : 'ghost'"
            :aria-pressed="view === 'stocktakes'"
            @click="switchView('stocktakes')"
            >{{ locale === 'en-US' ? 'Stocktakes' : '盘点单' }}</Button
          >
          <Button
            :variant="view === 'purchases' ? 'secondary' : 'ghost'"
            :aria-pressed="view === 'purchases'"
            @click="switchView('purchases')"
            >{{ locale === 'en-US' ? 'Purchasing' : '采购与补货' }}</Button
          >
          <Button
            :variant="view === 'history' ? 'secondary' : 'ghost'"
            :aria-pressed="view === 'history'"
            @click="showHistory()"
            >{{ t('history') }}</Button
          >
          <Button
            :variant="view === 'report' ? 'secondary' : 'ghost'"
            :aria-pressed="view === 'report'"
            @click="switchView('report')"
            >{{ t('report') }}</Button
          >
          <Button
            :variant="view === 'alerts' ? 'secondary' : 'ghost'"
            :aria-pressed="view === 'alerts'"
            @click="switchView('alerts')"
            >{{ locale === 'en-US' ? 'Stock alerts' : '预警中心' }}</Button
          >
          <Button
            :variant="view === 'holds' ? 'secondary' : 'ghost'"
            :aria-pressed="view === 'holds'"
            @click="switchView('holds')"
            >{{ locale === 'en-US' ? 'Ingredient holds' : '原料占用' }}</Button
          >
          <Button
            :variant="view === 'recipes' ? 'secondary' : 'ghost'"
            :aria-pressed="view === 'recipes'"
            @click="switchView('recipes')"
            >{{ t('recipes') }}</Button
          >
        </div>
      </div>
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
    <p class="text-xs leading-5 text-muted-foreground">
      {{ t('scopeHint') }}<template v-if="view !== 'report'"><br />{{ t('reportHint') }}</template>
    </p>
  </section>
</template>
<style scoped>
.inventory-page {
  display: grid;
  min-width: 0;
  gap: 1.25rem;
}
</style>
