<template>
  <view class="recommend">
    <view class="section-title">
      <text class="section-heading">推荐餐品</text>
    </view>
    <view v-if="products.length" class="grid">
      <view
        v-for="product in products"
        :key="product.id"
        class="card"
        role="button"
        tabindex="0"
        :aria-label="`查看${product.name}`"
        @keydown.enter="$emit('select', product.id)"
        @keydown.space.prevent="$emit('select', product.id)"
        @tap="$emit('select', product.id)"
      >
        <ProductThumbnail :src="product.imageUrl" />
        <text class="name">{{ product.name }}</text>
        <PriceText :price="product.price" :original-price="product.originalPrice" size="small" />

      </view>
    </view>
    <view v-else class="empty">
      <text class="empty-title">暂无推荐餐品</text>
      <AppActionButton variant="outline" @activate="$emit('browse')">查看菜单</AppActionButton>
    </view>
  </view>
</template>

<script setup lang="ts">
import AppActionButton from "@/components/app/AppActionButton.vue";
import ProductThumbnail from "@/components/app/ProductThumbnail.vue";
import PriceText from "@/components/app/PriceText.vue";
import type { ProductSummary } from "@/types/menu";

defineProps<{
  products: ProductSummary[];
}>();

defineEmits<{
  (event: "select", productId: string): void;
  (event: "browse"): void;
}>();
</script>

<style scoped>
.recommend {
  padding: var(--ld-card-padding, 24rpx);
  border-radius: var(--ld-radius-16, 16px);
  background: #ffffff;
  box-shadow: var(--ld-mini-shadow-float);
}

.section-title {
  display: flex;
  align-items: center;
  gap: 14rpx;
  margin-bottom: 18rpx;
}

.section-heading {
  color: var(--ld-mini-text);
  font-size: var(--ld-font-title, 32rpx);
  font-weight: 900;
}

.grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--ld-card-gap, 20rpx);
}

.empty {
  display: grid;
  justify-items: center;
  min-height: 164rpx;
  padding: 20rpx 16rpx 8rpx;
  text-align: center;
}

.empty-title {
  color: var(--ld-mini-text);
  font-size: 28rpx;
  font-weight: 800;
}

.card {
  position: relative;
  display: grid;
  grid-template-rows: 148rpx minmax(58rpx, auto) auto;
  min-height: 246rpx;
  padding: 16rpx;
  border-radius: var(--ld-radius-8, 8px);
  background: var(--ld-mini-surface);
}

.name {
  display: block;
  display: -webkit-box;
  overflow: hidden;
  margin: 12rpx 0 6rpx;
  color: var(--ld-mini-text);
  font-size: var(--ld-font-sm, 24rpx);
  font-weight: 700;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
</style>
