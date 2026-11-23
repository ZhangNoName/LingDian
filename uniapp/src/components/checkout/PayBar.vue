<template>
  <view class="pay-bar">
    <view class="pay-total">
      <text class="label">线下应付</text>
      <text class="amount">¥{{ formatAmount(amount.payableAmount) }}</text>
    </view>
    <AppActionButton size="large" :disabled="disabled" :loading="loading" @activate="$emit('submit')">提交订单</AppActionButton>
  </view>
</template>

<script setup lang="ts">
import { formatAmount } from "@/utils/money";
import AppActionButton from "@/components/app/AppActionButton.vue";
import type { OrderAmount } from "@/types/order";

defineProps<{
  amount: OrderAmount;
  disabled?: boolean;
  loading?: boolean;
}>();

defineEmits<{
  (event: "submit"): void;
}>();
</script>

<style scoped>
.pay-bar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12rpx;
  align-items: center;
  min-height: var(--ld-fixed-action-height, 128rpx);
  padding: 14rpx var(--ld-page-padding, 24rpx) calc(14rpx + env(safe-area-inset-bottom));
  background: #ffffff;
  border-top: 1rpx solid var(--ld-mini-border);
}

.pay-total { min-width: 0; }

.label {
  display: block;
  color: var(--ld-mini-text-muted);
  font-size: var(--ld-font-base, 26rpx);
}

.amount {
  display: block;
  color: var(--ld-mini-primary-pressed);
  font-size: var(--ld-font-price-lg, 40rpx);
  font-weight: 850;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}
</style>
