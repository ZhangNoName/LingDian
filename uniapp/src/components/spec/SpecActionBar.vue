<template>
  <view class="bar">
    <view class="thumbs">
      <image v-for="option in selectedOptions" :key="option.optionId" class="thumb" :src="option.imageUrl" mode="aspectFill" />
      <view class="no-add">不加购</view>
    </view>
    <view class="actions">
      <button class="outline" @tap="$emit('buy')">立即购买</button>
      <button class="solid" @tap="$emit('add')">加入购物车</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import type { SelectedOption } from "@/types/menu";

defineProps<{
  selectedOptions: SelectedOption[];
}>();

defineEmits<{
  (event: "buy"): void;
  (event: "add"): void;
}>();
</script>

<style scoped>
.bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 20;
  padding: 16rpx var(--ld-page-padding, 24rpx) calc(16rpx + env(safe-area-inset-bottom));
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 -20rpx 48rpx rgba(0, 0, 0, 0.06);
}

.thumbs {
  display: flex;
  gap: 12rpx;
  min-height: 76rpx;
  margin-bottom: 16rpx;
}

.thumb,
.no-add {
  width: 76rpx;
  height: 76rpx;
  border: 1rpx solid #b9934b;
  border-radius: 14rpx;
}

.no-add {
  display: grid;
  place-items: center;
  color: var(--ld-mini-primary);
  font-size: var(--ld-font-xs, 22rpx);
  font-weight: 800;
}

.actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--ld-card-gap, 20rpx);
}

.outline,
.solid {
  height: 78rpx;
  margin: 0;
  border-radius: 12rpx;
  font-size: var(--ld-font-title, 32rpx);
  font-weight: 900;
  line-height: 78rpx;
}

.outline {
  border: 1rpx solid var(--ld-mini-primary);
  background: #ffffff;
  color: var(--ld-mini-primary);
}

.solid {
  background: var(--ld-mini-primary);
  color: #ffffff;
}

.outline::after,
.solid::after {
  border: 0;
}
</style>
