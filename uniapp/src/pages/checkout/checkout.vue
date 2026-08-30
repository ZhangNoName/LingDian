<template>
  <Layout :show-tab-bar="false">
    <view class="page">
      <AppNavBar title="提交订单" show-back @back="goBack" />
      <CheckoutStoreCard
        :store="checkoutModel.store"
        :pickup-time-text="checkoutModel.pickupTimeText"
        :service-mode="serviceMode"
        @select-mode="selectMode"
      />
      <CheckoutAddressCard v-if="serviceMode === 'delivery'" :address="selectedAddress" @manage="manageAddresses" />
      <CheckoutProductCard :items="checkoutModel.items" />
      <view class="amount-card">
        <view class="amount-line"><text>商品金额</text><text>¥{{ checkoutModel.amount.goodsAmount.toFixed(1) }}</text></view>
        <view class="coupon-strip"><text>库存暂不阻断下单</text><text>模拟支付</text></view>
      </view>
      <PayBar :amount="checkoutModel.amount" :disabled="!submitAllowed" @pay="submitOrder" />
    </view>
  </Layout>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { onLoad, onShow } from "@dcloudio/uni-app";
import AppNavBar from "@/components/app/AppNavBar.vue";
import Layout from "@/layout/layout.vue";
import CheckoutProductCard from "@/components/checkout/CheckoutProductCard.vue";
import CheckoutStoreCard from "@/components/checkout/CheckoutStoreCard.vue";
import PayBar from "@/components/checkout/PayBar.vue";
import CheckoutAddressCard from "@/components/checkout/CheckoutAddressCard.vue";
import { fetchMenu } from "@/services/catalog";
import { getCartSummary } from "@/services/cart";
import { createOrderFromCart, createOrderRequestId } from "@/services/orders";
import { requireCustomerAuth } from "@/services/auth-navigation";
import { canCheckout, canSubmitCheckout } from "@/services/checkout-state";
import { addresses } from "@/services/addresses";
import { buildServiceModeUrl, parseServiceMode } from "@/services/service-mode";
import type { CartSummary } from "@/types/cart";
import type { ServiceMode, StoreSummary } from "@/types/store";
import type { UserAddress } from "@lingdian/contracts";

const cart = ref<CartSummary>(getCartSummary());
const orderRequestId = ref(createOrderRequestId());
const serviceMode = ref<ServiceMode>("takeaway");
const addressList = ref<UserAddress[]>([]);
const selectedAddress = computed(() => addressList.value.find((address) => address.isDefault) ?? addressList.value[0]);
const submitAllowed = computed(() => canSubmitCheckout({
  itemCount: cart.value.itemCount,
  serviceMode: serviceMode.value,
  addressId: selectedAddress.value?.id,
  businessStatus: store.value.businessStatus,
  supportedModes: store.value.supportModes,
}));
const store = ref<StoreSummary>({
  id: "",
  name: "零点点餐",
  businessText: "正在加载营业信息",
  distanceText: "当前门店",
  businessStatus: "open",
  supportModes: ["dineIn", "takeaway"],
});

const checkoutModel = computed(() => ({
  store: store.value,
  serviceMode: serviceMode.value,
  pickupTimeText: "时间未提供",
  items: cart.value.items,
  addOns: [],
  amount: {
    goodsAmount: cart.value.totalAmount,
    discountAmount: 0,
    couponAmount: 0,
    payableAmount: cart.value.totalAmount,
  },
}));

onLoad((query) => {
  serviceMode.value = parseServiceMode(query?.mode) ?? "takeaway";
});

onShow(async () => {
  const checkoutUrl = buildServiceModeUrl("/pages/checkout/checkout", serviceMode.value);
  if (!(await requireCustomerAuth(checkoutUrl))) return;
  cart.value = getCartSummary();
  if (!canCheckout(cart.value)) {
    uni.showToast({ title: "购物车为空，请先选择餐品", icon: "none" });
    uni.redirectTo({ url: "/pages/order/order" });
    return;
  }
  try {
    store.value = (await fetchMenu()).store;
    if (!store.value.supportModes.includes(serviceMode.value)) {
      const nextMode = store.value.supportModes[0];
      if (nextMode) serviceMode.value = nextMode;
    }
  } catch {
    // 结算页仍允许展示本地购物车，提交时会给出接口错误。
  }
  try {
    addressList.value = await addresses.list();
  } catch {
    addressList.value = [];
  }
});

function goBack() {
  uni.navigateBack();
}

async function submitOrder() {
  if (!submitAllowed.value) {
    uni.showToast({ title: serviceMode.value === "delivery" ? "请先选择收货地址" : "购物车为空", icon: "none" });
    return;
  }
  try {
    const order = await createOrderFromCart(cart.value, {
      serviceMode: serviceMode.value,
      addressId: selectedAddress.value?.id,
      clientRequestId: orderRequestId.value,
    });
    cart.value = getCartSummary();
    uni.redirectTo({ url: `/pages/order-detail/order-detail?id=${order.id}` });
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : "下单失败", icon: "none" });
  }
}

function selectMode(mode: ServiceMode) {
  if (!store.value.supportModes.includes(mode)) return;
  serviceMode.value = mode;
}

function manageAddresses() {
  uni.navigateTo({ url: "/pages/address/address" });
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  padding-bottom: calc(var(--ld-fixed-action-height, 128rpx) + var(--ld-page-bottom-safe, 24rpx));
  background: #f6f6f6;
}

.amount-card {
  margin: 0 var(--ld-page-padding, 24rpx) var(--ld-page-padding, 24rpx);
  padding: 0;
  border-radius: var(--ld-radius-16, 16px);
  background: #ffffff;
}

.amount-line {
  display: flex;
  justify-content: space-between;
  padding: 24rpx var(--ld-card-padding, 24rpx);
  color: var(--ld-mini-text);
  font-size: var(--ld-font-base, 26rpx);
  font-weight: 800;
}

.coupon-strip {
  display: flex;
  justify-content: space-between;
  gap: var(--ld-card-gap, 20rpx);
  padding: 18rpx var(--ld-card-padding, 24rpx);
  background: #fff0d1;
  color: var(--ld-mini-primary);
  font-size: var(--ld-font-sm, 24rpx);
  font-weight: 800;
}
</style>
