<template>
  <view class="store-header">
    <view>
      <text class="name">{{ store.name }} ›</text>
      <text class="distance">{{ store.distanceText }}</text>
    </view>
    <text class="dine-tag">堂食</text>
  </view>
</template>

<script setup lang="ts">
import type { StoreSummary } from "@/types/store";

defineProps<{
  store: StoreSummary;
}>();
</script>

<style scoped>
.store-header {
  position: relative;
  padding: 12rpx 32rpx 28rpx;
  background: #ffffff;
}

.name,
.distance {
  display: block;
}

.name {
  max-width: 520rpx;
  overflow: hidden;
  color: var(--ld-mini-text);
  font-size: 36rpx;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.distance {
  margin-top: 10rpx;
  color: var(--ld-mini-text-muted);
  font-size: 24rpx;
}

.dine-tag {
  position: absolute;
  right: 32rpx;
  top: 10rpx;
  min-width: 108rpx;
  height: 68rpx;
  border: 1rpx solid #f0dfc7;
  border-radius: 18rpx;
  background: #fff9ee;
  color: #7a491e;
  text-align: center;
  font-size: 30rpx;
  font-weight: 800;
  line-height: 68rpx;
}
</style>
