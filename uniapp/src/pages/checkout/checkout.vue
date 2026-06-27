<template>
  <view class="page">
    <AppNavBar title="提交订单" show-back @back="goBack" />
    <CheckoutStoreCard :store="checkoutModel.store" :pickup-time-text="checkoutModel.pickupTimeText" />
    <CheckoutProductCard :items="checkoutModel.items" />
    <view class="amount-card">
      <view class="amount-line"><text>商品金额</text><text>¥{{ checkoutModel.amount.goodsAmount.toFixed(1) }}</text></view>
      <view class="coupon-strip"><text>库存暂不阻断下单</text><text>模拟支付</text></view>
    </view>
    <PayBar :amount="checkoutModel.amount" @pay="submitOrder" />
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import AppNavBar from "@/components/app/AppNavBar.vue";
import CheckoutProductCard from "@/components/checkout/CheckoutProductCard.vue";
import CheckoutStoreCard from "@/components/checkout/CheckoutStoreCard.vue";
import PayBar from "@/components/checkout/PayBar.vue";
import { fetchMenu } from "@/services/catalog";
import { getCartSummary } from "@/services/cart";
import { createOrderFromCart } from "@/services/orders";
import type { CartSummary } from "@/types/cart";
import type { StoreSummary } from "@/types/store";

const cart = ref<CartSummary>(getCartSummary());
const store = ref<StoreSummary>({
  id: "",
  name: "零点点餐",
  address: "当前门店",
  distanceText: "当前门店",
  businessStatus: "open",
  supportModes: ["dineIn", "takeaway"],
});

const checkoutModel = computed(() => ({
  store: store.value,
  serviceMode: "takeaway" as const,
  pickupTimeText: "立即取餐",
  items: cart.value.items,
  addOns: [],
  amount: {
    goodsAmount: cart.value.totalAmount,
    discountAmount: 0,
    couponAmount: 0,
    payableAmount: cart.value.totalAmount,
  },
}));

onShow(async () => {
  cart.value = getCartSummary();
  try {
    store.value = (await fetchMenu()).store;
  } catch {
    // 结算页仍允许展示本地购物车，提交时会给出接口错误。
  }
});

function goBack() {
  uni.navigateBack();
}

async function submitOrder() {
  try {
    const order = await createOrderFromCart(cart.value);
    cart.value = getCartSummary();
    uni.redirectTo({ url: `/pages/order-detail/order-detail?id=${order.id}` });
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : "下单失败", icon: "none" });
  }
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

