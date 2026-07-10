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
      <view class="amount">
        <text class="amount-quantity">{{ item.quantity }}份</text>
        <text class="amount-price">¥{{ item.unitPrice.toFixed(1) }}</text>
      </view>
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

.product {
  display: grid;
  grid-template-columns: 104rpx minmax(0, 1fr) auto;
  gap: var(--ld-card-gap, 20rpx);
}

.image {
  width: 104rpx;
  height: 82rpx;
  border-radius: var(--ld-radius-8, 8px);
  background: #ffffff;
}

.name {
  display: block;
  overflow: hidden;
  margin-bottom: 10rpx;
  color: var(--ld-mini-text);
  font-size: var(--ld-font-md, 28rpx);
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.spec,
.expand {
  display: block;
  color: #8a8a8a;
  font-size: var(--ld-font-sm, 24rpx);
  line-height: 1.45;
}

.amount {
  text-align: right;
}

.amount-quantity,
.amount-price {
  display: block;
  color: var(--ld-mini-text);
  font-size: var(--ld-font-base, 26rpx);
  font-weight: 800;
}
</style>
