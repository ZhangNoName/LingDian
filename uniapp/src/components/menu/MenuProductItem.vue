<template>
  <view class="item">
    <button class="product-preview" :aria-label="`查看${product.name}详情`" @tap="$emit('select', product.id)" @keydown.enter.prevent="$emit('select', product.id)" @keydown.space.prevent="$emit('select', product.id)">
      <ProductThumbnail :src="product.imageUrl" compact />
    </button>
    <view class="body">
      <text class="name">{{ product.name }}</text>
      <text v-for="tag in product.tags" :key="tag" class="tag">{{ tag }}</text>
      <view class="product-actions">
        <PriceText :price="product.price" :original-price="product.originalPrice" />
        <AppActionButton v-if="product.hasSpec" class="product-control" size="small" @activate="$emit('select', product.id)">选规格</AppActionButton>
        <QuantityStepper
          v-else-if="product.skuId"
          class="product-control"
          :model-value="quantity"
          :min="0"
          :item-name="product.name"
          collapse-at-zero
          compact
          @update:model-value="$emit('quantity', product.id, $event)"
        />
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import AppActionButton from "@/components/app/AppActionButton.vue";
import PriceText from "@/components/app/PriceText.vue";
import ProductThumbnail from "@/components/app/ProductThumbnail.vue";
import QuantityStepper from "@/components/app/QuantityStepper.vue";
import type { ProductSummary } from "@/types/menu";

defineProps<{
  product: ProductSummary;
  quantity: number;
}>();

defineEmits<{
  (event: "select", productId: string): void;
  (event: "quantity", productId: string, value: number): void;
}>();
</script>

<style scoped>
.item {
  display: grid;
  grid-template-columns: 152rpx minmax(0, 1fr);
  gap: 16rpx;
  margin-bottom: 12rpx;
  padding: 14rpx;
  border: 1rpx solid var(--ld-mini-border);
  border-radius: var(--ld-radius-8, 8px);
  background: var(--ld-mini-surface);
}

.product-preview {
  align-self: start;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: var(--ld-radius-8, 8px);
  background: transparent;
}

.product-preview::after {
  border: 0;
}

.body {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.name {
  display: -webkit-box;
  overflow: hidden;
  margin: 2rpx 0 6rpx;
  color: var(--ld-mini-text);
  font-size: var(--ld-font-md, 28rpx);
  font-weight: 800;
  line-height: 1.25;
  overflow-wrap: anywhere;
  word-break: break-word;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.tag {
  display: inline-flex;
  align-self: flex-start;
  padding: 4rpx 10rpx;
  border-radius: 8rpx;
  background: var(--ld-mini-warning-bg);
  color: var(--ld-mini-warning-text);
  font-size: var(--ld-font-xs, 22rpx);
  line-height: 1;
}

.product-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 8rpx 12rpx;
  margin-top: auto;
  padding-top: 8rpx;
}

.product-control {
  margin-left: auto;
}
</style>
