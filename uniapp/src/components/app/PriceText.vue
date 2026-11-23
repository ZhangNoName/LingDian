<template>
  <view class="price" :class="`price--${size}`">
    <text class="price-current">¥{{ formatAmount(price) }}</text>
    <text v-if="originalPrice" class="price-original">¥{{ formatAmount(originalPrice) }}</text>
    <text v-if="suffix" class="price-suffix">{{ suffix }}</text>
  </view>
</template>

<script setup lang="ts">
import { formatAmount } from "@/utils/money";

withDefaults(
  defineProps<{
    price: number;
    originalPrice?: number;
    suffix?: string;
    size?: "small" | "normal" | "large";
  }>(),
  {
    size: "normal",
  },
);
</script>

<style scoped>
.price {
  display: flex;
  align-items: baseline;
  gap: 8rpx;
}

.price-current {
  color: var(--ld-mini-primary);
  font-weight: 800;
}

.price--small .price-current {
  font-size: var(--ld-font-base, 26rpx);
}

.price--normal .price-current {
  font-size: var(--ld-font-price, 36rpx);
}

.price--large .price-current {
  font-size: var(--ld-font-price-lg, 40rpx);
}

.price-original {
  color: var(--ld-mini-text-muted);
  font-size: var(--ld-font-sm, 24rpx);
  text-decoration: line-through;
}

.price-suffix {
  color: var(--ld-mini-primary);
  font-size: var(--ld-font-sm, 24rpx);
}
</style>
