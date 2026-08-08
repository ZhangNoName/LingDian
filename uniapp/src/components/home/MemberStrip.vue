<template>
  <view class="member-strip">
    <view class="account">
      <text class="name">{{ presentation.displayName }}</text>
      <button v-if="!presentation.isSignedIn" class="login-action" role="button" tabindex="0" @keydown.enter="$emit('login')" @tap="$emit('login')">立即登录</button>
      <text v-else class="account-status">{{ presentation.secondaryText }}</text>
    </view>
    <view class="metric">
      <text class="metric-value">{{ presentation.pointsText }}</text>
      <text class="metric-label">积分</text>
    </view>
    <view class="metric">
      <text class="metric-value">{{ presentation.couponText }}</text>
      <text class="metric-label">优惠券</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import type { CustomerPresentation } from "@/services/customer-presentation";

defineProps<{
  presentation: CustomerPresentation;
}>();

defineEmits<{
  (event: "login"): void;
}>();
</script>

<style scoped>
.member-strip {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 116rpx 116rpx;
  align-items: center;
  min-height: 112rpx;
  margin: 0;
  padding: 0 var(--ld-card-padding, 24rpx);
  border-radius: var(--ld-radius-16, 16px);
  background: #65140d;
  color: #ffe5b0;
  font-size: var(--ld-font-base, 26rpx);
}

.account {
  min-width: 0;
  overflow: hidden;
}

.metric {
  display: flex;
  min-width: 0;
  flex-direction: column;
  align-items: flex-end;
}

.account-status {
  display: block;
  overflow: hidden;
  margin-top: 6rpx;
  color: rgba(255, 229, 176, 0.88);
  font-size: 22rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.login-action {
  box-sizing: border-box;
  display: inline-flex;
  max-width: 100%;
  overflow: hidden;
  height: 44rpx;
  margin: 6rpx 0 0;
  padding: 0 16rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.5);
  border-radius: 999rpx;
  background: transparent;
  color: #ffffff;
  font-size: 22rpx;
  line-height: 42rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.login-action::after {
  border: 0;
}

.metric-value {
  text-align: right;
  color: #ffffff;
  font-size: var(--ld-font-md, 28rpx);
  font-weight: 800;
}

.metric-label {
  margin-top: 2rpx;
  color: rgba(255, 229, 176, 0.84);
  font-size: var(--ld-font-xs, 22rpx);
}

.name {
  display: block;
  overflow: hidden;
  color: #ffffff;
  text-align: left !important;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 800;
}
</style>
