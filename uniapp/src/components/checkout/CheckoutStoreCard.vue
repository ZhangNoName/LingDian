<template>
  <view class="card">
    <view class="title-row">
      <text class="title">{{ store.name }}</text>
      <text class="distance">{{ store.distanceText }}</text>
    </view>
    <text class="address">{{ store.address }}</text>
    <view class="mode-grid">
      <view class="mode active">
        <view class="mode-icon-shell">
          <CheckoutDineInIcon class="mode-icon" :stroke-width="2.3" />
        </view>
        <text class="mode-title">堂食</text>
        <text class="mode-subtitle">店内就餐</text>
      </view>
      <view class="mode">
        <view class="mode-icon-shell">
          <CheckoutTakeawayIcon class="mode-icon" :stroke-width="2.3" />
        </view>
        <text class="mode-title">外带</text>
        <text class="mode-subtitle">打包带走</text>
      </view>
    </view>
    <view class="pickup"><text>取餐时间 <text class="tag">出餐保障</text></text><text class="pickup-time">{{ pickupTimeText }} ›</text></view>
  </view>
</template>

<script setup lang="ts">
import { CheckoutDineInIcon, CheckoutTakeawayIcon } from "@lingdian/icons/miniapp";
import type { StoreSummary } from "@/types/store";

defineProps<{
  store: StoreSummary;
  pickupTimeText: string;
}>();
</script>

<style scoped>
.card {
  margin: 0 var(--ld-page-padding, 24rpx) var(--ld-page-padding, 24rpx);
  padding: var(--ld-card-padding, 24rpx);
  border-radius: var(--ld-radius-16, 16px);
  background: #ffffff;
  box-shadow: var(--ld-mini-shadow-float);
}

.title-row,
.pickup {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.title {
  color: var(--ld-mini-text);
  font-size: var(--ld-font-title, 32rpx);
  font-weight: 900;
}

.distance,
.address {
  color: #777777;
  font-size: 26rpx;
}

.address {
  display: block;
  margin: 12rpx 0 22rpx;
  line-height: 1.45;
}

.mode-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20rpx;
}

.mode {
  position: relative;
  min-height: 104rpx;
  min-width: 0;
  padding: 18rpx 14rpx 18rpx 82rpx;
  border: 1rpx solid #e2e2e2;
  border-radius: 14rpx;
}

.mode.active {
  border: 4rpx solid var(--ld-mini-primary);
}

.mode-icon-shell {
  position: absolute;
  left: 14rpx;
  top: 22rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 60rpx;
  height: 52rpx;
  border-radius: 16rpx;
  background: rgba(18, 163, 82, 0.1);
  color: var(--ld-mini-primary);
}

.mode-icon {
  width: 34rpx;
  height: 34rpx;
}

.mode-title,
.mode-subtitle {
  display: block;
}

.mode-title {
  color: var(--ld-mini-text);
  font-size: var(--ld-font-title, 32rpx);
  font-weight: 900;
}

.mode-subtitle {
  margin-top: 6rpx;
  color: #888888;
  font-size: 24rpx;
}

.pickup {
  margin-top: 22rpx;
  padding-top: 20rpx;
  border-top: 1rpx solid #f1f1f1;
  color: var(--ld-mini-text);
  font-size: var(--ld-font-base, 26rpx);
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
