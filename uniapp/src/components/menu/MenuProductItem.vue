<template>
  <view class="item">
    <image class="image" :src="product.imageUrl" mode="aspectFill" />
    <view class="body">
      <text class="name">{{ product.name }}</text>
      <text v-for="tag in product.tags" :key="tag" class="tag">{{ tag }}</text>
      <PriceText :price="product.price" :original-price="product.originalPrice" />
      <button class="select" @tap="$emit('select', product.id)">选规格</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import PriceText from "@/components/app/PriceText.vue";
import type { ProductSummary } from "@/types/menu";

defineProps<{
  product: ProductSummary;
}>();

defineEmits<{
  (event: "select", productId: string): void;
}>();
</script>

<style scoped>
.item {
  position: relative;
  display: grid;
  grid-template-columns: 190rpx 1fr;
  gap: var(--ld-card-gap, 20rpx);
  min-height: var(--ld-list-row-height, 208rpx);
  padding: 24rpx 0;
  border-bottom: 1rpx solid #f1f1f1;
}

.image {
  width: 190rpx;
  height: 144rpx;
  border-radius: var(--ld-radius-8, 8px);
  background: #ffffff;
}

.name {
  display: block;
  margin: 2rpx 0 10rpx;
  color: var(--ld-mini-text);
  font-size: var(--ld-font-md, 28rpx);
  font-weight: 800;
  line-height: 1.25;
}

.tag {
  display: inline-flex;
  margin-bottom: 12rpx;
  padding: 4rpx 10rpx;
  border: 1rpx solid #f3a1a6;
  color: var(--ld-mini-primary);
  font-size: var(--ld-font-xs, 22rpx);
  line-height: 1;
}

.select {
  position: absolute;
  right: 0;
  bottom: 28rpx;
  width: 118rpx;
  height: 52rpx;
  margin: 0;
  padding: 0;
  border-radius: 999rpx;
  background: var(--ld-mini-primary);
  color: #ffffff;
  font-size: var(--ld-font-xs, 22rpx);
  font-weight: 800;
  line-height: 52rpx;
}

.select::after {
  border: 0;
}
</style>
