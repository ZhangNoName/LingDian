<template>
  <view class="cart-bar">
    <view class="bag">
      <text>零</text>
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
  left: 24rpx;
  right: 24rpx;
  bottom: 24rpx;
  z-index: 15;
  display: grid;
  grid-template-columns: 118rpx 1fr 200rpx;
  align-items: center;
  min-height: 132rpx;
  border-radius: 24rpx;
  background: var(--ld-mini-primary);
  color: #ffffff;
  box-shadow: 0 28rpx 56rpx rgba(237, 28, 36, 0.22);
}

.bag {
  position: relative;
  width: 96rpx;
  height: 96rpx;
  margin-left: 14rpx;
  border-radius: 22rpx;
  background: #fff2d9;
  color: var(--ld-mini-primary);
  text-align: center;
  font-size: 42rpx;
  font-weight: 900;
  line-height: 96rpx;
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
  font-size: 44rpx;
  font-weight: 900;
}

.discount {
  display: block;
  overflow: hidden;
  margin-top: 4rpx;
  color: rgba(255, 255, 255, 0.78);
  font-size: 22rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.checkout {
  height: 132rpx;
  margin: 0;
  padding: 0;
  border-left: 1rpx solid rgba(255, 255, 255, 0.18);
  border-radius: 0 24rpx 24rpx 0;
  background: transparent;
  color: #ffffff;
  font-size: 36rpx;
  font-weight: 900;
  line-height: 132rpx;
}

.checkout::after {
  border: 0;
}
</style>
