<template>
  <view class="pay-bar">
    <view><text class="label">合计：</text><text class="amount">¥{{ amount.payableAmount.toFixed(1) }}</text></view>
    <button class="pay" @tap="$emit('pay')">去支付</button>
  </view>
</template>

<script setup lang="ts">
import type { OrderAmount } from "@/types/order";

defineProps<{
  amount: OrderAmount;
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
  grid-template-columns: 1fr 300rpx;
  align-items: center;
  min-height: 116rpx;
  padding: 16rpx 24rpx calc(16rpx + env(safe-area-inset-bottom));
  background: #ffffff;
}

.label {
  color: #777777;
  font-size: 28rpx;
}

.amount {
  color: var(--ld-mini-text);
  font-size: 52rpx;
  font-weight: 900;
}

.pay {
  height: 92rpx;
  margin: 0;
  border-radius: 12rpx;
  background: var(--ld-mini-primary);
  color: #ffffff;
  font-size: 34rpx;
  font-weight: 900;
  line-height: 92rpx;
}

.pay::after {
  border: 0;
}
</style>
