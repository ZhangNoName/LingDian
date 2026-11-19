<template>
  <Layout :show-tab-bar="false">
    <view class="page">
      <AppNavBar title="提交订单" show-back @back="goBack" />
      <CheckoutStoreCard
        v-if="store"
        :store="store"
        :pickup-time-text="checkoutModel.pickupTimeText"
        :service-mode="serviceMode"
        @select-mode="selectMode"
      />
      <view v-else class="store-state">
        <text>{{ storeError || "正在加载门店信息…" }}</text>
        <AppActionButton v-if="storeError" size="small" variant="outline" @activate="loadStore">重试</AppActionButton>
      </view>
      <CheckoutAddressCard v-if="serviceMode === 'delivery'" :address="selectedAddress" @manage="manageAddresses" />
      <CheckoutProductCard :items="checkoutModel.items" :disabled="submitting" @quantity="updateQuantity" />
      <view class="amount-card">
        <view class="amount-line"><text>商品金额</text><text>¥{{ formatAmount(checkoutModel.amount.goodsAmount) }}</text></view>
        <view class="amount-line"><text>支付方式</text><text>现金支付</text></view>
      </view>
      <PayBar :amount="checkoutModel.amount" :disabled="!submitAllowed" :loading="submitting" @submit="submitOrder" />
    </view>
  </Layout>
</template>

<script setup lang="ts">
import { formatAmount } from "@/utils/money";
import { computed, ref } from "vue";
import { onLoad, onShow } from "@dcloudio/uni-app";
import AppActionButton from "@/components/app/AppActionButton.vue";
import AppNavBar from "@/components/app/AppNavBar.vue";
import Layout from "@/layout/layout.vue";
import CheckoutProductCard from "@/components/checkout/CheckoutProductCard.vue";
import CheckoutStoreCard from "@/components/checkout/CheckoutStoreCard.vue";
import PayBar from "@/components/checkout/PayBar.vue";
import CheckoutAddressCard from "@/components/checkout/CheckoutAddressCard.vue";
import { fetchMenu } from "@/services/catalog";
import { getCartSummary, setCartQuantity } from "@/services/cart";
import { createOrderFromCart } from "@/services/orders";
import { navigateBackOrRedirect, requireCustomerAuth } from "@/services/auth-navigation";
import { canCheckout, canSubmitCheckout } from "@/services/checkout-state";
import { addresses } from "@/services/addresses";
import { buildServiceModeUrl, parseServiceMode } from "@/services/service-mode";
import type { CartSummary } from "@/types/cart";
import type { ServiceMode, StoreSummary } from "@/types/store";
import type { UserAddress } from "@lingdian/contracts";

const cart = ref<CartSummary>(getCartSummary());
const serviceMode = ref<ServiceMode>("takeaway");
const addressList = ref<UserAddress[]>([]);
const selectedAddress = computed(() => addressList.value.find((address) => address.isDefault) ?? addressList.value[0]);
const store = ref<StoreSummary | null>(null);
const storeError = ref("");
const submitting = ref(false);
const submitAllowed = computed(() => canSubmitCheckout({
  itemCount: cart.value.itemCount,
  serviceMode: serviceMode.value,
  addressId: selectedAddress.value?.id,
  store: store.value,
}));
const checkoutModel = computed(() => ({
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
  addressList.value = [];
  await Promise.all([loadStore(), loadAddresses()]);
});

let storeRequest = 0;
async function loadStore() {
  const request = ++storeRequest;
  store.value = null;
  storeError.value = "";
  try {
    const menu = await fetchMenu({ force: true });
    if (request !== storeRequest) return;
    store.value = menu.store;
    if (!menu.store.supportModes.includes(serviceMode.value) && menu.store.supportModes[0]) {
      serviceMode.value = menu.store.supportModes[0];
    }
  } catch (error) {
    if (request === storeRequest) storeError.value = error instanceof Error ? error.message : "门店信息加载失败";
  }
}

let addressRequest = 0;
async function loadAddresses() {
  const request = ++addressRequest;
  try {
    const list = await addresses.list();
    if (request === addressRequest) addressList.value = list;
  } catch (error) {
    if (request === addressRequest && serviceMode.value === "delivery") {
      uni.showToast({ title: error instanceof Error ? error.message : "地址加载失败", icon: "none" });
    }
  }
}

function updateQuantity(id: string, quantity: number) {
  if (submitting.value) return;
  cart.value = setCartQuantity(id, quantity);
  if (!cart.value.itemCount) uni.redirectTo({ url: buildServiceModeUrl("/pages/order/order", serviceMode.value) });
}

function goBack() {
  navigateBackOrRedirect(buildServiceModeUrl("/pages/order/order", serviceMode.value));
}

async function submitOrder() {
  if (!submitAllowed.value || submitting.value) return;
  submitting.value = true;
  try {
    const order = await createOrderFromCart(cart.value, {
      serviceMode: serviceMode.value,
      addressId: selectedAddress.value?.id,
    });
    cart.value = getCartSummary();
    uni.redirectTo({ url: `/pages/order-detail/order-detail?id=${order.id}` });
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : "下单失败", icon: "none" });
  } finally {
    submitting.value = false;
  }
}

function selectMode(mode: ServiceMode) {
  if (submitting.value || !store.value?.supportModes.includes(mode)) return;
  serviceMode.value = mode;
}

function manageAddresses() {
  if (!submitting.value) uni.navigateTo({ url: "/pages/address/address" });
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

.store-state {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--ld-card-padding, 24rpx);
}
</style>
