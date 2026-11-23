<template>
  <view class="cart-bar">
    <button class="cart-summary" :aria-label="`查看购物车，已选 ${cart.itemCount} 件`" @tap="emit('open-cart')" @keydown.enter.prevent="emit('open-cart')" @keydown.space.prevent="emit('open-cart')">
      <view class="bag">
        <AppIcon name="cart" :size="40" tone="primary" />
        <text class="badge">{{ cart.itemCount }}</text>
      </view>
      <view class="summary">
        <text class="amount">¥{{ formatAmount(cart.totalAmount) }}</text>
        <text v-if="cart.discountAmount > 0" class="discount">已优惠 ¥{{ formatAmount(cart.discountAmount) }}</text>
      </view>
    </button>
    <button class="checkout" @tap="emit('checkout')" @keydown.enter.prevent="emit('checkout')" @keydown.space.prevent="emit('checkout')">结算</button>
  </view>
</template>

<script setup lang="ts">
import { formatAmount } from "@/utils/money";
import AppIcon from "@/components/app/AppIcon.vue";
import type { CartSummary } from "@/types/cart";

defineProps<{
  cart: CartSummary;
}>();

const emit = defineEmits<{
  "open-cart": [];
  checkout: [];
}>();
</script>

<style scoped>
.cart-bar {
  margin: 12rpx var(--ld-page-padding, 24rpx) var(--ld-page-padding, 24rpx);
  display: grid;
  grid-template-columns: minmax(0, 1fr) 164rpx;
  align-items: center;
  min-height: 112rpx;
  padding: 0;
  border-radius: var(--ld-radius-8);
  background: var(--ld-mini-primary);
  color: #ffffff;
  box-shadow: var(--ld-mini-shadow-card);
}

.cart-summary {
  display: grid;
  grid-template-columns: 88rpx minmax(0, 1fr);
  align-items: center;
  width: 100%;
  min-width: 0;
  height: 112rpx;
  margin: 0;
  padding: 0;
  border-radius: 0;
  background: transparent;
  color: #ffffff;
  line-height: 1.25;
  text-align: left;
}

.bag {
  position: relative;
  display: grid;
  place-items: center;
  justify-self: center;
  width: 76rpx;
  height: 76rpx;
  margin: 0;
  border-radius: var(--ld-radius-16, 16px);
  background: var(--ld-mini-warning-bg);
  color: var(--ld-mini-primary);
  text-align: center;
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
  min-width: 0;
  overflow: hidden;
}

.amount {
  display: block;
  overflow: hidden;
  font-size: var(--ld-font-price-lg, 40rpx);
  font-weight: 900;
  font-variant-numeric: tabular-nums;
  text-overflow: ellipsis;
  white-space: nowrap;
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
  min-width: 0;
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
  white-space: nowrap;
}

.cart-summary::after,
.checkout::after {
  border: 0;
}
</style>
