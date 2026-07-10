<template>
  <view class="card">
    <view class="store-row">
      <text class="store">{{ detail.storeName }}</text>
      <view class="actions">
        <PhoneIcon class="action-icon" :stroke-width="2.2" />
        <MessageIcon class="action-icon" :stroke-width="2.2" />
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
import { MessageIcon, PhoneIcon } from "@lingdian/icons/miniapp";
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
  font-weight: 900;
}

.actions {
  display: flex;
  gap: 22rpx;
  color: #b7b7b7;
}

.action-icon {
  width: 32rpx;
  height: 32rpx;
}

.item {
  display: grid;
  grid-template-columns: 112rpx 1fr 96rpx;
  gap: var(--ld-card-gap, 20rpx);
  padding: 24rpx 0 10rpx;
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
  color: #777777;
  font-size: var(--ld-font-sm, 24rpx);
}

.amount {
  text-align: right;
}

.qty {
  display: block;
  color: #999999;
  font-size: var(--ld-font-sm, 24rpx);
}

.price {
  display: block;
  margin-top: 22rpx;
  color: var(--ld-mini-text);
  font-size: var(--ld-font-title, 32rpx);
  font-weight: 900;
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
  color: #999999;
  font-size: var(--ld-font-sm, 24rpx);
}

.total-row strong {
  color: var(--ld-mini-text);
  font-size: var(--ld-font-price, 36rpx);
}
</style>
