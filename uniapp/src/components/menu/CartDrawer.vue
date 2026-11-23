<template>
  <view class="cart-overlay">
    <view class="cart-backdrop" aria-hidden="true" @tap="emit('close')" @touchmove.stop.prevent />
    <view class="drawer" role="dialog" aria-modal="true" aria-label="购物车" @keydown.esc.stop="emit('close')">
      <view class="drawer-header">
        <text class="drawer-title">购物车</text>
        <view class="header-actions">
          <button class="clear" @tap="emit('clear')" @keydown.enter.prevent="emit('clear')" @keydown.space.prevent="emit('clear')">清空购物车</button>
          <button class="close" aria-label="关闭购物车" @tap="emit('close')" @keydown.enter.prevent="emit('close')" @keydown.space.prevent="emit('close')">×</button>
        </view>
      </view>
      <scroll-view class="drawer-scroll" scroll-y>
        <view class="drawer-items">
          <CartItemList :items="cart.items" compact @quantity="(id, value) => emit('quantity', id, value)" />
        </view>
      </scroll-view>
      <view class="drawer-footer">
        <view class="drawer-total">
          <text class="drawer-total-label">合计</text>
          <text class="drawer-total-amount">¥{{ formatAmount(cart.totalAmount) }}</text>
        </view>
        <AppActionButton class="drawer-checkout" size="large" @activate="emit('checkout')">结算</AppActionButton>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import AppActionButton from "@/components/app/AppActionButton.vue";
import CartItemList from "@/components/app/CartItemList.vue";
import type { CartSummary } from "@/types/cart";
import { formatAmount } from "@/utils/money";

defineProps<{ cart: CartSummary }>();
const emit = defineEmits<{ close: []; clear: []; checkout: []; quantity: [id: string, value: number] }>();
</script>

<style scoped>
.cart-overlay,
.cart-backdrop {
  position: fixed;
  inset: 0;
}

.cart-overlay {
  z-index: 50;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.cart-backdrop { background: rgba(25, 18, 16, .48); }

.drawer {
  position: relative;
  width: 100%;
  max-width: 540px;
  overflow: hidden;
  border-radius: var(--ld-radius-16) var(--ld-radius-16) 0 0;
  background: var(--ld-mini-surface);
  animation: drawer-enter 180ms ease-out;
}

@keyframes drawer-enter {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

@media (prefers-reduced-motion: reduce) {
  .drawer { animation: none; }
}

.drawer-header,
.drawer-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  padding: 12rpx var(--ld-page-padding);
}

.drawer-title {
  color: var(--ld-mini-text);
  font-size: var(--ld-font-title);
  font-weight: 800;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.clear {
  min-height: 44px;
  margin: 0;
  padding: 0 8rpx;
  background: transparent;
  color: var(--ld-mini-text-muted);
  font-size: var(--ld-font-sm);
  line-height: 44px;
  white-space: nowrap;
}

.close {
  display: grid;
  width: 44px;
  height: 44px;
  margin: 0 -8px 0 0;
  padding: 0;
  place-items: center;
  background: transparent;
  color: var(--ld-mini-text-muted);
  font-size: 28px;
  line-height: 1;
}

.clear::after, .close::after { border: 0; }

.drawer-scroll { max-height: 48vh; }

.drawer-items { padding: 8rpx var(--ld-page-padding) 24rpx; }

.drawer-footer {
  padding-top: 18rpx;
  padding-bottom: calc(18rpx + env(safe-area-inset-bottom));
  border-top: 1rpx solid var(--ld-mini-border);
}

.drawer-total {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8rpx;
}

.drawer-total-label { color: var(--ld-mini-text-muted); font-size: var(--ld-font-sm); }

.drawer-total-amount {
  color: var(--ld-mini-primary-pressed);
  font-size: var(--ld-font-price);
  font-weight: 900;
  font-variant-numeric: tabular-nums;
}

.drawer-checkout { flex: 0 0 176rpx; }
</style>
