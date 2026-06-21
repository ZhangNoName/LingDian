<template>
  <view class="card">
    <view class="store-row">
      <text class="store">{{ detail.storeName }}</text>
      <view class="actions">
        <text>☎</text>
        <text>☆</text>
      </view>
    </view>

    <view v-for="item in detail.items" :key="item.id" class="item">
      <image class="image" :src="item.imageUrl" mode="aspectFill" />
      <view class="info">
        <text class="name">{{ item.name }}</text>
        <text v-if="item.tag" class="tag">{{ item.tag }}</text>
        <text v-for="spec in item.specs" :key="spec" class="spec">{{ spec }}</text>
      </view>
      <view class="amount">
        <text class="qty">{{ item.quantity }}份</text>
        <text class="price">¥{{ formatAmount(item.price) }}</text>
      </view>
    </view>

    <view class="divider" />
    <view class="amount-row"><text>商品总价</text><text>¥{{ formatAmount(detail.goodsAmount) }}</text></view>
    <view class="amount-row"><text>{{ detail.discountTitle }}</text><text>- ¥{{ formatAmount(detail.discountAmount) }}</text></view>
    <view class="total-row"><text>共{{ detail.itemCount }}件商品，合计：</text><strong>¥{{ formatAmount(detail.totalAmount) }}</strong></view>
  </view>
</template>

<script setup lang="ts">
import type { OrderDetail } from "@/types/order";

defineProps<{
  detail: OrderDetail;
}>();

function formatAmount(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
</script>

<style scoped>
.card {
  margin: 24rpx;
  padding: 32rpx;
  border-radius: 24rpx;
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
  font-size: 34rpx;
  font-weight: 900;
}

.actions {
  display: flex;
  gap: 28rpx;
  color: #b7b7b7;
  font-size: 38rpx;
}

.item {
  display: grid;
  grid-template-columns: 132rpx 1fr 108rpx;
  gap: 20rpx;
  padding: 34rpx 0 12rpx;
}

.image {
  width: 120rpx;
  height: 96rpx;
  border-radius: 14rpx;
  background: #ffffff;
}

.name,
.tag,
.spec {
  display: block;
}

.name {
  color: var(--ld-mini-text);
  font-size: 30rpx;
  font-weight: 800;
}

.tag {
  margin-top: 12rpx;
  color: var(--ld-mini-primary);
  font-size: 24rpx;
}

.spec {
  margin-top: 8rpx;
  color: #777777;
  font-size: 24rpx;
}

.amount {
  text-align: right;
}

.qty {
  display: block;
  color: #999999;
  font-size: 28rpx;
}

.price {
  display: block;
  margin-top: 30rpx;
  color: var(--ld-mini-text);
  font-size: 32rpx;
  font-weight: 900;
}

.divider {
  height: 1rpx;
  margin: 24rpx 0;
  background: #eeeeee;
}

.amount-row {
  min-height: 64rpx;
  color: var(--ld-mini-text);
  font-size: 30rpx;
  font-weight: 800;
}

.total-row {
  justify-content: flex-end;
  gap: 16rpx;
  min-height: 84rpx;
  color: #999999;
  font-size: 28rpx;
}

.total-row strong {
  color: var(--ld-mini-text);
  font-size: 38rpx;
}
</style>
