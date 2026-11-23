<template>
  <view class="items" :class="{ compact }">
    <view v-for="item in items" :key="item.id" class="product">
      <ProductThumbnail :src="item.imageUrl" small />
      <view class="info">
        <text class="name">{{ item.productName }}</text>
        <text v-if="item.skuName && (!compact || item.skuName !== '默认')" class="spec">{{ item.skuName }}</text>
        <text v-for="option in item.selectedOptions" :key="option.optionId" class="spec">1 x {{ option.name }}</text>
      </view>
      <view class="amount">
        <QuantityStepper
          :model-value="item.quantity"
          :min="0"
          :disabled="disabled"
          :compact="compact"
          :item-name="compact ? item.productName : undefined"
          @update:model-value="emit('quantity', item.id, $event)"
        />
        <text class="amount-price">¥{{ formatAmount(item.unitPrice) }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import ProductThumbnail from "@/components/app/ProductThumbnail.vue";
import QuantityStepper from "@/components/app/QuantityStepper.vue";
import { formatAmount } from "@/utils/money";
import type { CartItem } from "@/types/cart";

defineProps<{ items: CartItem[]; disabled?: boolean; compact?: boolean }>();
const emit = defineEmits<{ quantity: [id: string, value: number] }>();
</script>

<style scoped>
.product {
  display: grid;
  grid-template-columns: 104rpx minmax(0, 1fr) auto;
  gap: var(--ld-card-gap, 20rpx);
}

.product + .product {
  margin-top: 16rpx;
  padding-top: 16rpx;
  border-top: 1rpx solid var(--ld-mini-border);
}

.name {
  display: block;
  overflow: hidden;
  margin-bottom: 10rpx;
  color: var(--ld-mini-text);
  font-size: var(--ld-font-md, 28rpx);
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.compact .name { white-space: normal; overflow-wrap: anywhere; }

.spec {
  display: block;
  color: var(--ld-mini-text-muted);
  font-size: var(--ld-font-sm, 24rpx);
  line-height: 1.45;
}

.amount { text-align: right; }

.amount-price {
  display: block;
  color: var(--ld-mini-text);
  font-size: var(--ld-font-base, 26rpx);
  font-weight: 800;
}
</style>
