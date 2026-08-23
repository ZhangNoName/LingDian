<template>
  <view class="item">
    <view class="image-shell">
      <image v-if="!imageFailed" class="image" :src="product.imageUrl" mode="aspectFill" @error="imageFailed = true" />
      <view v-else class="image-placeholder">
        <text class="placeholder-icon">餐</text>
        <text class="placeholder-copy">图片待更新</text>
      </view>
    </view>
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
import { ref } from "vue";
import type { ProductSummary } from "@/types/menu";

const imageFailed = ref(false);

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

.image-shell,
.image,
.image-placeholder {
  width: 176rpx;
  height: 132rpx;
  border-radius: var(--ld-radius-8, 8px);
}

.image-shell {
  overflow: hidden;
  background: #ffffff;
}

.image-placeholder {
  display: grid;
  place-items: center;
  align-content: center;
  gap: 4rpx;
  background: linear-gradient(145deg, #fff7e9, #f8efe1);
  color: #b77935;
}

.placeholder-icon {
  display: block;
  width: 42rpx;
  height: 42rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.78);
  text-align: center;
  font-size: 22rpx;
  font-weight: 900;
  line-height: 42rpx;
}

.placeholder-copy {
  color: #9b7650;
  font-size: 18rpx;
  line-height: 1.2;
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

.select {
  position: absolute;
  right: 0;
  bottom: 20rpx;
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
