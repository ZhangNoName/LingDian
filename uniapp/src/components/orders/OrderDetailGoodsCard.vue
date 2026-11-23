<template>
  <view class="card">
    <view class="store-row">
      <text class="store">{{ detail.storeName }}</text>
    </view>

    <view v-for="item in detail.items" :key="item.id" class="item" :class="{ 'with-image': item.imageUrl }">
      <image v-if="item.imageUrl" class="image" :src="item.imageUrl" mode="aspectFit" />
      <view class="info">
        <text class="name">{{ item.name }}</text>
        <text v-if="item.tag" class="tag">{{ item.tag }}</text>
        <text v-for="spec in item.specs" :key="spec" class="spec">{{ spec }}</text>
      </view>
      <view class="amount">
        <text class="qty">{{ item.quantity }}份</text>
        <text class="price">¥{{ formatAmount(item.subtotal) }}</text>
      </view>
    </view>

    <view class="divider" />
    <view v-if="detail.discountAmount > 0 || formatAmount(detail.goodsAmount) !== formatAmount(detail.totalAmount)" class="amount-row">
      <text>商品总价</text><text>¥{{ formatAmount(detail.goodsAmount) }}</text>
    </view>
    <view v-if="detail.discountAmount > 0" class="amount-row"><text>{{ detail.discountTitle }}</text><text>- ¥{{ formatAmount(detail.discountAmount) }}</text></view>
    <view class="total-row"><text>共{{ detail.itemCount }}件 · 合计</text><text class="total-price">¥{{ formatAmount(detail.totalAmount) }}</text></view>
  </view>
</template>

<script setup lang="ts">
import { formatAmount } from "@/utils/money";
import type { OrderDetail } from "@/types/order";

defineProps<{
  detail: OrderDetail;
}>();

</script>

<style scoped>
.card {
  margin: var(--ld-page-padding, 24rpx);
  padding: var(--ld-card-padding, 24rpx);
  border-radius: var(--ld-radius-16, 16px);
  background: #ffffff;
}

.store-row,
.amount-row,
.total-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.store {
  color: var(--ld-mini-text);
  font-size: var(--ld-font-title, 32rpx);
  font-weight: 750;
}

.item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--ld-card-gap, 20rpx);
  padding: 24rpx 0 10rpx;
}

.with-image {
  grid-template-columns: 104rpx minmax(0, 1fr) auto;
}

.image {
  width: 104rpx;
  height: 80rpx;
  border-radius: var(--ld-radius-8, 8px);
  background: #ffffff;
}

.name,
.tag,
.spec {
  display: block;
}

.name {
  color: var(--ld-mini-text);
  font-size: var(--ld-font-md, 28rpx);
  font-weight: 800;
}

.tag {
  margin-top: 12rpx;
  color: var(--ld-mini-primary);
  font-size: var(--ld-font-sm, 24rpx);
}

.spec {
  margin-top: 8rpx;
  color: var(--ld-mini-text-muted);
  font-size: var(--ld-font-sm, 24rpx);
}

.amount {
  text-align: right;
}

.qty {
  display: block;
  color: var(--ld-mini-text-muted);
  font-size: var(--ld-font-sm, 24rpx);
}

.price {
  display: block;
  margin-top: 8rpx;
  color: var(--ld-mini-text);
  font-size: var(--ld-font-md);
  font-weight: 700;
  white-space: nowrap;
}

.divider {
  height: 1rpx;
  margin: 18rpx 0;
  background: #eeeeee;
}

.amount-row {
  min-height: 54rpx;
  color: var(--ld-mini-text);
  font-size: var(--ld-font-base, 26rpx);
  font-weight: 800;
}

.total-row {
  justify-content: flex-end;
  gap: 12rpx;
  min-height: 68rpx;
  color: var(--ld-mini-text-muted);
  font-size: var(--ld-font-sm, 24rpx);
}

.total-price {
  color: var(--ld-mini-primary-pressed);
  font-size: var(--ld-font-price, 36rpx);
  font-weight: 750;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
</style>
