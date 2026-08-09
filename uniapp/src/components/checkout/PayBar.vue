<template>
  <view class="pay-bar">
    <view><text class="label">合计：</text><text class="amount">¥{{ amount.payableAmount.toFixed(1) }}</text></view>
    <button :class="['pay', { disabled }]" role="button" tabindex="0" :disabled="disabled" @keydown.enter="$emit('pay')" @tap="$emit('pay')">去支付</button>
  </view>
</template>

<script setup lang="ts">
import type { OrderAmount } from "@/types/order";

defineProps<{
  amount: OrderAmount;
  disabled?: boolean;
}>();

defineEmits<{
  (event: "pay"): void;
}>();
</script>

<style scoped>
.pay-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  display: grid;
  grid-template-columns: 1fr 260rpx;
  align-items: center;
  min-height: var(--ld-fixed-action-height, 128rpx);
  padding: 14rpx var(--ld-page-padding, 24rpx) calc(14rpx + env(safe-area-inset-bottom));
  background: #ffffff;
}

.label {
  color: #777777;
  font-size: var(--ld-font-base, 26rpx);
}

.amount {
  color: var(--ld-mini-text);
  font-size: var(--ld-font-price-lg, 40rpx);
  font-weight: 900;
}

.pay {
  height: 78rpx;
  margin: 0;
  border-radius: 12rpx;
  background: var(--ld-mini-primary);
  color: #ffffff;
  font-size: var(--ld-font-title, 32rpx);
  font-weight: 900;
  line-height: 78rpx;
}

.pay::after {
  border: 0;
}

.pay.disabled {
  background: #c9c9c9;
  color: #ffffff;
}
</style>
