<template>
  <view class="recommend">
    <view class="section-title">
      <text>堡藏推荐</text>
      <text class="tag">福利满满</text>
    </view>
    <view class="grid">
      <view v-for="product in products" :key="product.id" class="card" @tap="$emit('select', product.id)">
        <image class="image" :src="product.imageUrl" mode="aspectFill" />
        <text class="name">{{ product.name }}</text>
        <PriceText :price="product.price" :original-price="product.originalPrice" suffix="一口价" size="small" />
        <button class="add">+</button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import PriceText from "@/components/app/PriceText.vue";
import type { ProductSummary } from "@/types/menu";

defineProps<{
  products: ProductSummary[];
}>();

defineEmits<{
  (event: "select", productId: string): void;
}>();
</script>

<style scoped>
.recommend {
  padding: var(--ld-card-padding, 24rpx);
  border-radius: var(--ld-radius-16, 16px);
  background: #ffffff;
  box-shadow: var(--ld-mini-shadow-card);
}

.section-title {
  display: flex;
  align-items: center;
  gap: 14rpx;
  margin-bottom: 18rpx;
}

.section-title text:first-child {
  color: var(--ld-mini-text);
  font-size: var(--ld-font-title, 32rpx);
  font-weight: 900;
}

.tag {
  padding: 4rpx 14rpx;
  border-radius: 999rpx;
  background: #ff9700;
  color: #ffffff;
  font-size: var(--ld-font-xs, 22rpx);
  font-weight: 800;
}

.grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--ld-card-gap, 20rpx);
}

.card {
  position: relative;
  min-height: 214rpx;
  padding: 16rpx;
  border-radius: var(--ld-radius-8, 8px);
  background: #fffaf0;
}

.image {
  width: 100%;
  height: 96rpx;
  border-radius: var(--ld-radius-8, 8px);
  background: #ffffff;
}

.name {
  display: block;
  margin: 12rpx 0 6rpx;
  color: var(--ld-mini-text);
  font-size: var(--ld-font-sm, 24rpx);
  font-weight: 700;
}

.add {
  position: absolute;
  right: 16rpx;
  bottom: 16rpx;
  display: grid;
  place-items: center;
  width: 42rpx;
  height: 42rpx;
  margin: 0;
  padding: 0;
  border-radius: 50%;
  background: var(--ld-mini-primary);
  color: #ffffff;
  font-size: var(--ld-font-title, 32rpx);
  line-height: 38rpx;
}

.add::after {
  border: 0;
}
</style>
