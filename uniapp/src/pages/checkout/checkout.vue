<template>
  <Layout :show-tab-bar="false">
    <template #header>
      <AppNavBar title="提交订单" show-back @back="goBack" />
    </template>
    <view class="checkout-content-inner">
      <view v-if="storeError || !store" class="store-state">
        <text>{{ storeError || "正在加载门店信息…" }}</text>
        <AppActionButton v-if="storeError" size="small" variant="outline" @activate="refreshCheckout">重试</AppActionButton>
      </view>
      <CheckoutStoreCard
        v-else
        :store="store"
        :pickup-time-text="checkoutModel.pickupTimeText"
        :service-mode="serviceMode"
        @select-mode="selectMode"
      />
      <view v-if="serviceMode === 'delivery' && (addressesLoading || addressError)" class="store-state" role="status">
        <text>{{ addressError || "正在加载收货地址…" }}</text>
        <AppActionButton v-if="addressError" size="small" variant="outline" @activate="loadAddresses">重试</AppActionButton>
      </view>
      <CheckoutAddressCard v-else-if="serviceMode === 'delivery'" :address="selectedAddress" @manage="manageAddresses" />
      <CheckoutProductCard :items="checkoutModel.items" :disabled="submitting" @quantity="updateQuantity" />
      <view class="remark-card">
        <text class="remark-label">订单备注</text>
        <textarea
          v-model="remark"
          class="remark-input"
          :maxlength="MAX_ORDER_REMARK_LENGTH"
          :disabled="submitting"
          placeholder="选填，如少放辣椒、不要餐具"
          aria-label="订单备注"
        />
      </view>
      <view v-if="store" class="payment-note">
        <text class="payment-label">线下支付</text>
        <text>请在下单后线下付款。小程序不支持线上支付。</text>
      </view>
    </view>
    <template #footer>
      <PayBar :amount="checkoutModel.amount" :disabled="!submitAllowed" :loading="submitting" @submit="submitOrder" />
    </template>
  </Layout>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { onLoad, onShow } from "@dcloudio/uni-app";
import AppActionButton from "@/components/app/AppActionButton.vue";
import AppNavBar from "@/components/app/AppNavBar.vue";
import Layout from "@/layout/layout.vue";
import CheckoutProductCard from "@/components/checkout/CheckoutProductCard.vue";
import CheckoutStoreCard from "@/components/checkout/CheckoutStoreCard.vue";
import PayBar from "@/components/checkout/PayBar.vue";
import CheckoutAddressCard from "@/components/checkout/CheckoutAddressCard.vue";
import { fetchMenu, peekMenu } from "@/services/catalog";
import { getCartSummary, setCartQuantity } from "@/services/cart";
import { createOrderFromCart, MAX_ORDER_REMARK_LENGTH } from "@/services/orders";
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
const addressesLoading = ref(false);
const addressError = ref("");
const selectedAddressId = ref("");
const selectedAddress = computed(() => addressList.value.find((address) => address.id === selectedAddressId.value));
const store = ref<StoreSummary | null>(peekMenu()?.store ?? null);
const storeError = ref("");
const storeVerified = ref(false);
const remark = ref("");
const submitting = ref(false);
const submitAllowed = computed(() => storeVerified.value && canSubmitCheckout({
  itemCount: cart.value.itemCount,
  serviceMode: serviceMode.value,
  addressId: selectedAddress.value?.id,
  store: store.value,
}));
const checkoutModel = computed(() => ({
  pickupTimeText: "",
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
  storeVerified.value = false;
  if (!(await requireCustomerAuth())) return;
  cart.value = getCartSummary();
  if (!canCheckout(cart.value)) {
    uni.showToast({ title: "购物车为空，请先选择餐品", icon: "none" });
    uni.redirectTo({ url: "/pages/order/order" });
    return;
  }
  addressList.value = [];
  await refreshCheckout();
});

async function refreshCheckout() {
  const addressRequest = loadDeliveryAddresses();
  await loadStore();
  await (addressRequest ?? loadDeliveryAddresses());
}

let storeRequest = 0;
async function loadStore() {
  const request = ++storeRequest;
  storeVerified.value = false;
  storeError.value = "";
  try {
    const menu = await fetchMenu({ force: true });
    if (request !== storeRequest) return;
    if (menu.paymentRequired === false) throw new Error("门店收款设置暂不可用，请稍后重试");
    store.value = menu.store;
    if (!menu.store.supportModes.includes(serviceMode.value) && menu.store.supportModes[0]) {
      serviceMode.value = menu.store.supportModes[0];
    }
    storeVerified.value = true;
  } catch (error) {
    if (request === storeRequest) {
      store.value = null;
      storeError.value = error instanceof Error ? error.message : "门店信息加载失败";
    }
  }
}

function loadDeliveryAddresses() {
  if (serviceMode.value === "delivery") return loadAddresses();
}

let addressRequest = 0;
async function loadAddresses() {
  const request = ++addressRequest;
  addressesLoading.value = true;
  addressError.value = "";
  try {
    const list = await addresses.list();
    if (request === addressRequest) addressList.value = list;
  } catch (error) {
    if (request === addressRequest) addressError.value = error instanceof Error ? error.message : "地址加载失败";
  } finally {
    if (request === addressRequest) addressesLoading.value = false;
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
      remark: remark.value,
    });
    cart.value = getCartSummary();
    uni.redirectTo({
      url: `/pages/order-detail/order-detail?id=${encodeURIComponent(order.id)}&from=checkout`,
      fail: () => uni.reLaunch({ url: "/pages/his/his" }),
    });
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : "下单失败", icon: "none" });
  } finally {
    submitting.value = false;
  }
}

function selectMode(mode: ServiceMode) {
  if (submitting.value || mode === serviceMode.value || !store.value?.supportModes.includes(mode)) return;
  serviceMode.value = mode;
  if (storeVerified.value) void loadDeliveryAddresses();
}

function manageAddresses() {
  if (submitting.value) return;
  uni.navigateTo({
    url: "/pages/address/address?select=1",
    events: {
      addressSelected: (id: string) => { selectedAddressId.value = id; },
    },
  });
}
</script>

<style scoped>
.checkout-content-inner {
  padding-top: var(--ld-page-padding, 24rpx);
  padding-bottom: 12rpx;
}

.remark-card,
.payment-note {
  margin: 0 var(--ld-page-padding) var(--ld-page-padding);
  padding: 24rpx var(--ld-card-padding);
  border-radius: var(--ld-radius-16);
  background: var(--ld-mini-surface);
}

.remark-label {
  display: block;
  margin-bottom: 12rpx;
  color: var(--ld-mini-text);
  font-size: var(--ld-font-base);
  font-weight: 700;
}

.remark-input {
  box-sizing: border-box;
  width: 100%;
  height: 144rpx;
  padding: 16rpx 20rpx;
  border: 1rpx solid var(--ld-mini-border);
  border-radius: var(--ld-radius-8);
  background: var(--ld-mini-bg);
  color: var(--ld-mini-text);
  font-size: var(--ld-font-base);
  line-height: 1.5;
}

.payment-note {
  display: grid;
  gap: 8rpx;
  color: var(--ld-mini-text-muted);
  font-size: var(--ld-font-base);
}

.payment-label {
  color: var(--ld-mini-text);
  font-weight: 700;
}

.store-state {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--ld-card-padding, 24rpx);
}
</style>
