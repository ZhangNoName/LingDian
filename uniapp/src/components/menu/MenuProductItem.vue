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
  grid-template-columns: 224rpx 1fr;
  gap: 24rpx;
  min-height: 252rpx;
  padding: 32rpx 0;
  border-bottom: 1rpx solid #f1f1f1;
}

.image {
  width: 224rpx;
  height: 176rpx;
  border-radius: 20rpx;
  background: #ffffff;
}

.name {
  display: block;
  margin: 6rpx 0 14rpx;
  color: var(--ld-mini-text);
  font-size: 30rpx;
  font-weight: 800;
  line-height: 1.25;
}

.tag {
  display: inline-flex;
  margin-bottom: 16rpx;
  padding: 4rpx 10rpx;
  border: 1rpx solid #f3a1a6;
  color: var(--ld-mini-primary);
  font-size: 22rpx;
  line-height: 1;
}

.select {
  position: absolute;
  right: 0;
  bottom: 34rpx;
  width: 132rpx;
  height: 60rpx;
  margin: 0;
  padding: 0;
  border-radius: 999rpx;
  background: var(--ld-mini-primary);
  color: #ffffff;
  font-size: 24rpx;
  font-weight: 800;
  line-height: 60rpx;
}

.select::after {
  border: 0;
}
</style>
