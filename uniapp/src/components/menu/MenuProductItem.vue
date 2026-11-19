<template>
  <view class="item">
    <ProductThumbnail :src="product.imageUrl" compact />
    <view class="body">
      <text class="name">{{ product.name }}</text>
      <text v-for="tag in product.tags" :key="tag" class="tag">{{ tag }}</text>
      <PriceText :price="product.price" :original-price="product.originalPrice" />
      <AppActionButton class="select" size="small" @activate="$emit('select', product.id)">选规格</AppActionButton>
    </view>
  </view>
</template>

<script setup lang="ts">
import AppActionButton from "@/components/app/AppActionButton.vue";
import PriceText from "@/components/app/PriceText.vue";
import ProductThumbnail from "@/components/app/ProductThumbnail.vue";
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
  grid-template-columns: 176rpx minmax(0, 1fr);
  gap: var(--ld-card-gap, 20rpx);
  min-height: 188rpx;
  padding: 20rpx 0;
  border-bottom: 1rpx solid #f1f1f1;
}

.name {
  display: -webkit-box;
  overflow: hidden;
  margin: 2rpx 0 10rpx;
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
  margin-bottom: 12rpx;
  padding: 4rpx 10rpx;
  border: 1rpx solid #f3a1a6;
  color: var(--ld-mini-primary);
  font-size: var(--ld-font-xs, 22rpx);
  line-height: 1;
}

.select { position: absolute; right: 0; bottom: 20rpx; }
</style>
