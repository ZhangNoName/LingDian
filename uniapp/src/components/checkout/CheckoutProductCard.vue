<template>
  <view class="card">
    <text class="section-title">餐品详情</text>
    <CartItemList :items="items" :disabled="disabled" @quantity="(id, value) => emit('quantity', id, value)" />
  </view>
</template>

<script setup lang="ts">
import CartItemList from "@/components/app/CartItemList.vue";
import type { CartItem } from "@/types/cart";

defineProps<{
  items: CartItem[];
  disabled?: boolean;
}>();
const emit = defineEmits<{ quantity: [id: string, value: number] }>();
</script>

<style scoped>
.card {
  margin: 0 var(--ld-page-padding, 24rpx) var(--ld-page-padding, 24rpx);
  padding: var(--ld-card-padding, 24rpx);
  border-radius: var(--ld-radius-16, 16px);
  background: #ffffff;
  box-shadow: var(--ld-mini-shadow-float);
}

.section-title {
  display: block;
  margin-bottom: 18rpx;
  color: var(--ld-mini-text);
  font-size: var(--ld-font-title, 32rpx);
  font-weight: 900;
}

</style>
