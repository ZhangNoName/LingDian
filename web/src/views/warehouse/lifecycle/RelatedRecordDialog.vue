<script setup lang="ts">
import type { InventoryUsageRow } from '@lingdian/contracts'
import RecipeEditor from '../RecipeEditor.vue'
import PurchaseDetail from '../purchasing/PurchaseDetail.vue'
import StocktakeDetail from '../stocktakes/StocktakeDetail.vue'
defineProps<{ record?: InventoryUsageRow; storeId: string; storeName: string }>()
defineEmits<{ close: []; saved: [] }>()
</script>
<template>
  <RecipeEditor
    v-if="record?.kind === 'RECIPES'"
    :store-id="storeId"
    :sku-id="record.skuId"
    @close="$emit('close')"
    @saved="$emit('saved')"
  />
  <PurchaseDetail
    v-else-if="record?.kind === 'PURCHASES'"
    :store-id="storeId"
    :id="record.orderId"
    @close="$emit('close')"
    @saved="$emit('saved')"
  />
  <StocktakeDetail
    v-else-if="record?.kind === 'STOCKTAKES'"
    :store-id="storeId"
    :store-name="storeName"
    :id="record.stocktakeId"
    @close="$emit('close')"
    @saved="$emit('saved')"
  />
</template>
