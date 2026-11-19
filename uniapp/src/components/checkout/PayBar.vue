<template>
  <view class="pay-bar">
    <view><text class="label">合计：</text><text class="amount">¥{{ formatAmount(amount.payableAmount) }}</text></view>
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
</style>
