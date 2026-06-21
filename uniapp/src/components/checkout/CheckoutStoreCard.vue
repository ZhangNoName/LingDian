<template>
  <view class="card">
    <view class="title-row">
      <text class="title">{{ store.name }}</text>
      <text class="distance">{{ store.distanceText }}</text>
    </view>
    <text class="address">{{ store.address }}</text>
    <view class="mode-grid">
      <view class="mode active"><SkeletonBox class="mode-icon" radius="md" /><text class="mode-title">堂食</text><text class="mode-subtitle">店内就餐</text></view>
      <view class="mode"><SkeletonBox class="mode-icon" radius="md" /><text class="mode-title">外带</text><text class="mode-subtitle">打包带走</text></view>
    </view>
    <view class="pickup"><text>取餐时间 <text class="tag">出餐保障</text></text><text class="pickup-time">{{ pickupTimeText }} ›</text></view>
  </view>
</template>

<script setup lang="ts">
import SkeletonBox from "@/components/app/SkeletonBox.vue";
import type { StoreSummary } from "@/types/store";

defineProps<{
  store: StoreSummary;
  pickupTimeText: string;
}>();
</script>

<style scoped>
.card {
  margin: 0 24rpx 24rpx;
  padding: 32rpx;
  border-radius: 20rpx;
  background: #ffffff;
}

.title-row,
.pickup {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.title {
  color: var(--ld-mini-text);
  font-size: 38rpx;
  font-weight: 900;
}

.distance,
.address {
  color: #777777;
  font-size: 26rpx;
}

.address {
  display: block;
  margin: 16rpx 0 30rpx;
  line-height: 1.45;
}

.mode-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20rpx;
}

.mode {
  position: relative;
  min-height: 120rpx;
  padding: 24rpx 20rpx 20rpx 112rpx;
  border: 1rpx solid #e2e2e2;
  border-radius: 14rpx;
}

.mode.active {
  border: 4rpx solid var(--ld-mini-primary);
}

.mode-icon {
  position: absolute;
  left: 22rpx;
  top: 28rpx;
  width: 68rpx;
  height: 60rpx;
}

.mode-title,
.mode-subtitle {
  display: block;
}

.mode-title {
  color: var(--ld-mini-text);
  font-size: 36rpx;
  font-weight: 900;
}

.mode-subtitle {
  margin-top: 6rpx;
  color: #888888;
  font-size: 24rpx;
}

.pickup {
  margin-top: 30rpx;
  padding-top: 26rpx;
  border-top: 1rpx solid #f1f1f1;
  color: var(--ld-mini-text);
  font-size: 30rpx;
}

.tag {
  margin-left: 8rpx;
  padding: 4rpx 10rpx;
  border: 1rpx solid #e0e0e0;
  border-radius: 8rpx;
  color: #777777;
  font-size: 24rpx;
}

.pickup-time {
  color: var(--ld-mini-primary);
  font-weight: 800;
}
</style>
