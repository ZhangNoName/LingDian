<template>
  <view class="card">
    <text class="section-title">餐品详情</text>
    <view v-for="item in items" :key="item.id" class="product">
      <image class="image" :src="item.imageUrl" mode="aspectFill" />
      <view class="info">
        <text class="name">{{ item.productName }}</text>
        <text v-for="option in item.selectedOptions" :key="option.optionId" class="spec">1 x {{ option.name }}</text>
        <text class="expand">展开⌄</text>
      </view>
      <view class="amount"><text>{{ item.quantity }}份</text><text>¥{{ item.unitPrice.toFixed(1) }}</text></view>
    </view>
  </view>
</template>

<script setup lang="ts">
import type { CartItem } from "@/types/cart";

defineProps<{
  items: CartItem[];
}>();
</script>

<style scoped>
.card {
  margin: 0 24rpx 24rpx;
  padding: 32rpx;
  border-radius: 20rpx;
  background: #ffffff;
}

.section-title {
  display: block;
  margin-bottom: 26rpx;
  color: var(--ld-mini-text);
  font-size: 34rpx;
  font-weight: 900;
}

.product {
  display: grid;
  grid-template-columns: 132rpx 1fr 108rpx;
  gap: 20rpx;
}

.image {
  width: 132rpx;
  height: 104rpx;
  border-radius: 14rpx;
  background: #ffffff;
}

.name {
  display: block;
  margin-bottom: 10rpx;
  color: var(--ld-mini-text);
  font-size: 30rpx;
  font-weight: 800;
}

.spec,
.expand {
  display: block;
  color: #8a8a8a;
  font-size: 24rpx;
  line-height: 1.45;
}

.amount {
  text-align: right;
}

.amount text {
  display: block;
  color: var(--ld-mini-text);
  font-size: 28rpx;
  font-weight: 800;
}
</style>
