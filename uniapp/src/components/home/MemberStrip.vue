<template>
  <view class="member-strip">
    <view class="account">
      <text class="name">{{ presentation.displayName }}</text>
      <button v-if="!presentation.isSignedIn" class="login-action" role="button" tabindex="0" @keydown.enter="$emit('login')" @tap="$emit('login')">立即登录</button>
      <text v-else class="account-status">{{ presentation.secondaryText }}</text>
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
  grid-template-columns: minmax(0, 1fr);
  align-items: center;
  min-height: 112rpx;
  margin: 0;
  padding: 0 var(--ld-card-padding, 24rpx);
  border-radius: var(--ld-radius-16, 16px);
  background: var(--ld-mini-surface);
  color: var(--ld-mini-text);
  font-size: var(--ld-font-base, 26rpx);
}

.account {
  min-width: 0;
  overflow: hidden;
}

.account-status {
  display: block;
  overflow: hidden;
  margin-top: 6rpx;
  color: var(--ld-mini-text-muted);
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
  border: 1rpx solid var(--ld-mini-border);
  border-radius: 999rpx;
  background: transparent;
  color: var(--ld-mini-text);
  font-size: 22rpx;
  line-height: 42rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.login-action::after {
  border: 0;
}

.name {
  display: block;
  overflow: hidden;
  color: var(--ld-mini-text);
  text-align: left !important;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 800;
}
</style>
