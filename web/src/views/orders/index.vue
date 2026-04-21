<template>
  <div
    class="grid h-full min-h-0 gap-5 overflow-hidden xl:grid-cols-[1.5fr_0.95fr]"
  >
    <div class="flex flex-col">
      <div class="flex shrink-0 flex-wrap gap-2">
        <Button
          v-for="category in categories"
          :key="category"
          :variant="activeCategory === category ? 'default' : 'outline'"
          class="rounded-md"
          @click="activeCategory = category"
        >
          {{ category }}
        </Button>
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto pr-1">
        <div class="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          <OrderProductCard
            v-for="product in filteredProducts"
            :key="product.id"
            :product="product"
            @add="addToCart"
          />
        </div>
      </div>
    </div>

    <OrderCheckoutPanel
      v-model:member-phone="memberPhone"
      v-model:remark="orderForm.remark"
      v-model:selected-coupon-code="selectedCouponCode"
      :available-coupons="availableCoupons"
      :cart-items="cartItems"
      :coupon-discount-amount="couponDiscountAmount"
      :discount-rate="discountRate"
      :member-discount-amount="memberDiscountAmount"
      :member-profile="memberProfile"
      :payable-amount="payableAmount"
      :selected-coupon="selectedCoupon"
      :subtotal="subtotal"
      :table-label="
        orderForm.orderType === 'dine_in' ? selectedTableLabel : '无需桌台'
      "
      @decrease-item="decreaseItem"
      @fill-demo-member="fillDemoMember"
      @increase-item="increaseItem"
      @open-checkout="openCheckoutDialog"
      @reset-order="resetOrder"
    />

    <OrderConfirmDialog
      v-model:open="checkoutDialogOpen"
      v-model:payment-method="paymentMethod"
      :available-tables="availableTables"
      :checkout-disabled="checkoutDisabled"
      :coupon-discount-amount="couponDiscountAmount"
      :dining-tables="diningTables"
      :member-discount-amount="memberDiscountAmount"
      :occupied-tables="occupiedTables"
      :order-form="orderForm"
      :payable-amount="payableAmount"
      :payment-methods="paymentMethods"
      :selected-order-mode-label="selectedOrderModeLabel"
      :selected-payment-label="selectedPaymentLabel"
      :selected-table-id="selectedTableId"
      :selected-table-label="selectedTableLabel"
      :subtotal="subtotal"
      :total-quantity="totalQuantity"
      @confirm-order="confirmOrder"
      @select-table="selectTable"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { Button } from "@/baseComponents/button";
import OrderCheckoutPanel from "./components/OrderCheckoutPanel.vue";
import OrderConfirmDialog from "./components/OrderConfirmDialog.vue";
import OrderProductCard from "./components/OrderProductCard.vue";
import {
  categories,
  coupons,
  diningTables,
  memberProfiles,
  orderModes,
  paymentMethods,
  products,
} from "./mock";
import type { CartItem, OrderForm, PaymentMethod, Product } from "./types";

const keyword = ref("");
const activeCategory = ref("全部");
const memberPhone = ref("");
const paymentMethod = ref<PaymentMethod>("cash");
const selectedCouponCode = ref("none");
const checkoutDialogOpen = ref(false);
const selectedTableId = ref("t-a01");

const orderForm = reactive<OrderForm>({
  orderType: "dine_in",
  guestCount: 2,
  cashier: "前台 01",
  storeName: "陆家嘴示范店",
  remark: "",
});

const cartItems = ref<CartItem[]>([
  {
    ...products[0],
    quantity: 1,
  },
  {
    ...products[3],
    quantity: 2,
  },
]);

const availableCoupons = coupons.filter((coupon) => coupon.code !== "none");

const filteredProducts = computed(() => {
  const normalizedKeyword = keyword.value.trim().toLowerCase();
  return products.filter((product) => {
    const matchesCategory =
      activeCategory.value === "全部" ||
      product.category === activeCategory.value;
    const matchesKeyword =
      normalizedKeyword.length === 0 ||
      product.name.toLowerCase().includes(normalizedKeyword) ||
      product.category.toLowerCase().includes(normalizedKeyword);

    return matchesCategory && matchesKeyword;
  });
});

const memberProfile = computed(() => memberProfiles[memberPhone.value] ?? null);
const discountRate = computed(() => memberProfile.value?.discountRate ?? 1);
const subtotal = computed(() =>
  cartItems.value.reduce((sum, item) => sum + item.price * item.quantity, 0),
);
const totalQuantity = computed(() =>
  cartItems.value.reduce((sum, item) => sum + item.quantity, 0),
);
const memberDiscountAmount = computed(
  () => subtotal.value * (1 - discountRate.value),
);
const afterMemberDiscount = computed(
  () => subtotal.value - memberDiscountAmount.value,
);
const selectedCoupon = computed(
  () =>
    coupons.find((coupon) => coupon.code === selectedCouponCode.value) ??
    coupons[0],
);
const couponDiscountAmount = computed(() =>
  Math.min(selectedCoupon.value.discountAmount, afterMemberDiscount.value),
);
const payableAmount = computed(
  () => afterMemberDiscount.value - couponDiscountAmount.value,
);
const selectedPaymentLabel = computed(
  () =>
    paymentMethods.find((method) => method.value === paymentMethod.value)
      ?.label ?? "现金",
);
const selectedOrderModeLabel = computed(
  () =>
    orderModes.find((mode) => mode.value === orderForm.orderType)?.label ??
    "堂食",
);
const selectedTable = computed(
  () =>
    diningTables.find((table) => table.id === selectedTableId.value) ?? null,
);
const selectedTableLabel = computed(
  () => selectedTable.value?.label ?? "请选择桌台",
);
const availableTables = computed(() =>
  diningTables.filter((table) => !table.occupied),
);
const occupiedTables = computed(() =>
  diningTables.filter((table) => table.occupied),
);
const checkoutDisabled = computed(
  () => orderForm.orderType === "dine_in" && !selectedTable.value,
);

function addToCart(product: Product) {
  const existing = cartItems.value.find((item) => item.id === product.id);
  if (existing) {
    existing.quantity += 1;
    return;
  }

  cartItems.value.push({
    ...product,
    quantity: 1,
  });
}

function increaseItem(id: string) {
  const target = cartItems.value.find((item) => item.id === id);
  if (target) {
    target.quantity += 1;
  }
}

function decreaseItem(id: string) {
  const target = cartItems.value.find((item) => item.id === id);
  if (!target) {
    return;
  }

  if (target.quantity === 1) {
    cartItems.value = cartItems.value.filter((item) => item.id !== id);
    return;
  }

  target.quantity -= 1;
}

function fillDemoMember() {
  memberPhone.value = "13900139000";
}

function selectTable(tableId: string) {
  const table = diningTables.find((item) => item.id === tableId);
  if (!table || table.occupied) {
    return;
  }

  selectedTableId.value = tableId;
}

function openCheckoutDialog() {
  if (cartItems.value.length === 0) {
    return;
  }

  if (orderForm.orderType === "dine_in" && selectedTable.value?.occupied) {
    selectedTableId.value = availableTables.value[0]?.id ?? "";
  }

  checkoutDialogOpen.value = true;
}

function confirmOrder() {
  if (checkoutDisabled.value) {
    return;
  }

  checkoutDialogOpen.value = false;
}

function resetOrder() {
  cartItems.value = [];
  memberPhone.value = "";
  selectedCouponCode.value = "none";
  paymentMethod.value = "cash";
  checkoutDialogOpen.value = false;
  selectedTableId.value = availableTables.value[0]?.id ?? "";
  orderForm.remark = "";
}
</script>
