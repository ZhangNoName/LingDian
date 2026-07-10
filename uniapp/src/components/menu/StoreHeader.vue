<template>
  <view class="store-header">
    <view>
      <text class="name">{{ store.name }}</text>
      <text class="distance">{{ store.distanceText }}</text>
    </view>
    <view class="dine-tag">
      <StoreLocationIcon class="tag-icon" :stroke-width="2.2" />
      <text>堂食</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { StoreLocationIcon } from "@lingdian/icons/miniapp";
import type { StoreSummary } from "@/types/store";

defineProps<{
  store: StoreSummary;
}>();
</script>

<style scoped>
.store-header {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16rpx var(--ld-page-padding, 24rpx) 20rpx;
  background: #ffffff;
}

.name,
.distance {
  display: block;
}

.name {
  max-width: 500rpx;
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
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6rpx;
  min-width: 116rpx;
  height: 60rpx;
  border: 1rpx solid #f0dfc7;
  border-radius: 18rpx;
  background: #fff9ee;
  color: #7a491e;
  text-align: center;
  font-size: 30rpx;
  font-weight: 800;
}

.tag-icon {
  width: 28rpx;
  height: 28rpx;
}
</style>
