<template>
  <view class="card">
    <view class="title-row">
      <text class="title">{{ store.name }}</text>
      <text class="distance">{{ store.distanceText }}</text>
    </view>
    <text class="business-text">{{ store.businessText }}</text>
    <view class="mode-grid">
      <view v-if="store.supportModes.includes('dineIn')" :class="['mode', { active: serviceMode === 'dineIn' }]" role="button" tabindex="0" @tap="$emit('select-mode', 'dineIn')">
        <view class="mode-icon-shell">
          <CheckoutDineInIcon class="mode-icon" aria-hidden="true" />
        </view>
        <text class="mode-title">到店堂食</text>
        <text class="mode-subtitle">店内就餐</text>
      </view>
      <view v-if="store.supportModes.includes('takeaway')" :class="['mode', { active: serviceMode === 'takeaway' }]" role="button" tabindex="0" @tap="$emit('select-mode', 'takeaway')">
        <view class="mode-icon-shell">
          <CheckoutTakeawayIcon class="mode-icon" aria-hidden="true" />
        </view>
        <text class="mode-title">门店自取</text>
        <text class="mode-subtitle">到店打包带走</text>
      </view>
      <view v-if="store.supportModes.includes('delivery')" :class="['mode', { active: serviceMode === 'delivery' }]" role="button" tabindex="0" @tap="$emit('select-mode', 'delivery')">
        <view class="mode-icon-shell">
          <HomeDeliveryIcon class="mode-icon" aria-hidden="true" />
        </view>
        <text class="mode-title">配送到家</text>
        <text class="mode-subtitle">送到收货地址</text>
      </view>
      <text v-if="store.supportModes.length === 0" class="mode-unavailable">当前门店暂不支持下单</text>
    </view>
    <view class="pickup">
      <text>{{ serviceMode === "delivery" ? "配送时间" : serviceMode === "dineIn" ? "就餐时间" : "取餐时间" }}</text>
      <text class="pickup-time">{{ serviceMode === "delivery" ? "时间未提供" : pickupTimeText }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { CheckoutDineInIcon, CheckoutTakeawayIcon, HomeDeliveryIcon } from "@lingdian/icons/miniapp";
import type { ServiceMode, StoreSummary } from "@/types/store";

defineProps<{
  store: StoreSummary;
  pickupTimeText: string;
  serviceMode: ServiceMode;
}>();

defineEmits<{
  (event: "select-mode", value: ServiceMode): void;
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
.business-text {
  color: #777777;
  font-size: 26rpx;
}

.business-text {
  display: block;
  margin: 12rpx 0 22rpx;
  line-height: 1.45;
}

.mode-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240rpx, 1fr));
  gap: 20rpx;
}

.mode-unavailable {
  color: var(--ld-mini-text-muted);
  font-size: var(--ld-font-sm, 24rpx);
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
  display: block;
  width: 34rpx;
  height: 34rpx;
  font-size: 34rpx;
  line-height: 34rpx;
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
