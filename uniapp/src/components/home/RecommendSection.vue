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
  padding: 28rpx;
  border-radius: 28rpx;
  background: #ffffff;
  box-shadow: var(--ld-mini-shadow-card);
}

.section-title {
  display: flex;
  align-items: center;
  gap: 18rpx;
  margin-bottom: 22rpx;
}

.section-title text:first-child {
  color: var(--ld-mini-text);
  font-size: 40rpx;
  font-weight: 900;
}

.tag {
  padding: 6rpx 18rpx;
  border-radius: 999rpx;
  background: #ff9700;
  color: #ffffff;
  font-size: 24rpx;
  font-weight: 800;
}

.grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 18rpx;
}

.card {
  position: relative;
  min-height: 238rpx;
  padding: 18rpx;
  border-radius: 18rpx;
  background: #fffaf0;
}

.image {
  width: 100%;
  height: 112rpx;
  border-radius: 14rpx;
  background: #ffffff;
}

.name {
  display: block;
  margin: 14rpx 0 8rpx;
  color: var(--ld-mini-text);
  font-size: 26rpx;
  font-weight: 700;
}

.add {
  position: absolute;
  right: 18rpx;
  bottom: 18rpx;
  display: grid;
  place-items: center;
  width: 48rpx;
  height: 48rpx;
  margin: 0;
  padding: 0;
  border-radius: 50%;
  background: var(--ld-mini-primary);
  color: #ffffff;
  font-size: 34rpx;
  line-height: 44rpx;
}

.add::after {
  border: 0;
}
</style>
