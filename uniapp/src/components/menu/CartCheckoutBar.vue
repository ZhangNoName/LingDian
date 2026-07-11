<template>
  <view class="cart-bar">
    <view class="bag">
      <text class="cart-icon">{{ CartIcon }}</text>
      <text v-if="cart.itemCount" class="badge">{{ cart.itemCount }}</text>
    </view>
    <view class="summary">
      <text class="amount">¥{{ cart.totalAmount.toFixed(1) }}</text>
      <text class="discount">预估到手 共优惠¥{{ cart.discountAmount.toFixed(1) }}</text>
    </view>
    <button class="checkout" @tap="$emit('checkout')">去结算</button>
  </view>
</template>

<script setup lang="ts">
import { CartIcon } from "@lingdian/icons/miniapp";
import type { CartSummary } from "@/types/cart";

defineProps<{
  cart: CartSummary;
}>();

defineEmits<{
  (event: "checkout"): void;
}>();
</script>

<style scoped>
.cart-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: calc(var(--ld-tabbar-height, 104rpx) + env(safe-area-inset-bottom));
  z-index: 15;
  display: grid;
  grid-template-columns: 104rpx 1fr 176rpx;
  align-items: center;
  min-height: 112rpx;
  padding: 0 var(--ld-page-padding, 24rpx);
  border-radius: 24rpx 24rpx 0 0;
  background: var(--ld-mini-primary);
  color: #ffffff;
  box-shadow: 0 28rpx 56rpx rgba(237, 28, 36, 0.22);
}

.bag {
  position: relative;
  width: 80rpx;
  height: 80rpx;
  margin-left: 12rpx;
  border-radius: var(--ld-radius-16, 16px);
  background: #fff2d9;
  color: var(--ld-mini-primary);
  text-align: center;
}

.cart-icon {
  display: block;
  width: 40rpx;
  height: 40rpx;
  font-size: 40rpx;
  line-height: 40rpx;
}

.badge {
  position: absolute;
  right: -10rpx;
  top: -14rpx;
  width: 36rpx;
  height: 36rpx;
  border-radius: 50%;
  background: var(--ld-mini-primary);
  color: #ffffff;
  font-size: 22rpx;
  line-height: 36rpx;
}

.summary {
  overflow: hidden;
}

.amount {
  display: block;
  font-size: var(--ld-font-price-lg, 40rpx);
  font-weight: 900;
}

.discount {
  display: block;
  overflow: hidden;
  margin-top: 4rpx;
  color: rgba(255, 255, 255, 0.78);
  font-size: var(--ld-font-xs, 22rpx);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.checkout {
  height: 112rpx;
  margin: 0;
  padding: 0;
  border-left: 1rpx solid rgba(255, 255, 255, 0.18);
  border-radius: 0;
  background: transparent;
  color: #ffffff;
  font-size: var(--ld-font-title, 32rpx);
  font-weight: 900;
  line-height: 112rpx;
}

.checkout::after {
  border: 0;
}
</style>
