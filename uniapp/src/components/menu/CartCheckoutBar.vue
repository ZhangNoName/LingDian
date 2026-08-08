<template>
  <view class="cart-bar" :class="{ 'is-disabled': disabled }">
    <view class="bag">
      <CartIcon class="cart-icon" aria-hidden="true" />
      <text v-if="cart.itemCount" class="badge">{{ cart.itemCount }}</text>
    </view>
    <view class="summary">
      <text class="amount">¥{{ cart.totalAmount.toFixed(1) }}</text>
      <text class="discount">预估到手 共优惠¥{{ cart.discountAmount.toFixed(1) }}</text>
    </view>
    <button class="checkout" role="button" tabindex="0" :disabled="disabled" :aria-label="disabled ? '购物车为空，请先选择餐品' : '去结算'" @keydown.enter="handleCheckout" @tap="handleCheckout">
      {{ disabled ? "请选择餐品" : "去结算" }}
    </button>
  </view>
</template>

<script setup lang="ts">
import { CartIcon } from "@lingdian/icons/miniapp";
import { computed } from "vue";
import type { CartSummary } from "@/types/cart";
import { canCheckout } from "@/services/checkout-state";

const props = defineProps<{
  cart: CartSummary;
}>();

const emit = defineEmits<{
  (event: "checkout"): void;
}>();

const disabled = computed(() => !canCheckout(props.cart));

function handleCheckout() {
  if (!disabled.value) emit("checkout");
}
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

.cart-bar.is-disabled {
  background: #5f5f5f;
  box-shadow: 0 20rpx 40rpx rgba(0, 0, 0, 0.14);
}

.cart-bar.is-disabled .bag {
  color: #5f5f5f;
}

.bag {
  position: relative;
  display: grid;
  place-items: center;
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

.checkout[disabled] {
  color: rgba(255, 255, 255, 0.9);
}

.checkout::after {
  border: 0;
}
</style>
