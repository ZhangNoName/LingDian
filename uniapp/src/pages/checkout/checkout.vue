<template>
  <view class="page">
    <AppNavBar title="提交订单" show-back @back="goBack" />
    <CheckoutStoreCard :store="checkoutModel.store" :pickup-time-text="checkoutModel.pickupTimeText" />
    <CheckoutProductCard :items="checkoutModel.items" />
    <AddOnList :items="checkoutModel.addOns" />
    <view class="amount-card">
      <view class="amount-line"><text>商品金额</text><text>¥{{ checkoutModel.amount.goodsAmount.toFixed(1) }}</text></view>
      <view class="coupon-strip"><text>省钱券包 ¥0.01 购买价值¥40券包</text><text>已优惠{{ checkoutModel.amount.discountAmount }}元</text></view>
    </view>
    <PayBar :amount="checkoutModel.amount" @pay="goOrders" />
  </view>
</template>

<script setup lang="ts">
import AppNavBar from "@/components/app/AppNavBar.vue";
import AddOnList from "@/components/checkout/AddOnList.vue";
import CheckoutProductCard from "@/components/checkout/CheckoutProductCard.vue";
import CheckoutStoreCard from "@/components/checkout/CheckoutStoreCard.vue";
import PayBar from "@/components/checkout/PayBar.vue";
import { checkoutModel } from "@/data/mock";

function goBack() {
  uni.navigateBack();
}

function goOrders() {
  uni.redirectTo({ url: "/pages/his/his" });
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  padding-bottom: 136rpx;
  background: #f6f6f6;
}

.amount-card {
  margin: 0 var(--ld-page-padding, 24rpx) var(--ld-page-padding, 24rpx);
  padding: 0 var(--ld-card-padding, 24rpx) var(--ld-card-padding, 24rpx);
  border-radius: var(--ld-radius-16, 16px);
  background: #ffffff;
}

.amount-line {
  display: flex;
  justify-content: space-between;
  padding: 24rpx 0;
  color: var(--ld-mini-text);
  font-size: var(--ld-font-base, 26rpx);
  font-weight: 800;
}

.coupon-strip {
  display: flex;
  justify-content: space-between;
  gap: var(--ld-card-gap, 20rpx);
  margin: 0 calc(-1 * var(--ld-card-padding, 24rpx));
  padding: 18rpx var(--ld-card-padding, 24rpx);
  background: #fff0d1;
  color: var(--ld-mini-primary);
  font-size: var(--ld-font-sm, 24rpx);
  font-weight: 800;
}
</style>
