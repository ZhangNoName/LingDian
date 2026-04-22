import { computed, reactive } from "vue";
import {
  coupons,
  diningTables,
  memberProfiles,
  orderModes,
  paymentMethods,
  products,
} from "@/views/orders/mock";
import type { CartItem, OrderForm, PaymentMethod, Product } from "@/views/orders/types";

type OrderState = {
  keyword: string;
  activeCategory: string;
  memberPhone: string;
  paymentMethod: PaymentMethod;
  selectedCouponCode: string;
  checkoutDialogOpen: boolean;
  selectedTableId: string;
  orderForm: OrderForm;
  cartItems: CartItem[];
};

const state = reactive<OrderState>({
  keyword: "",
  activeCategory: "全部",
  memberPhone: "",
  paymentMethod: "cash",
  selectedCouponCode: "none",
  checkoutDialogOpen: false,
  selectedTableId: "t-a01",
  orderForm: {
    orderType: "dine_in",
    guestCount: 2,
    cashier: "前台 01",
    storeName: "陆家嘴示范店",
    remark: "",
  },
  cartItems: [
    {
      ...products[0],
      quantity: 1,
    },
    {
      ...products[3],
      quantity: 2,
    },
  ],
});

const availableCoupons = coupons.filter((coupon) => coupon.code !== "none");

const filteredProducts = computed(() => {
  const normalizedKeyword = state.keyword.trim().toLowerCase();
  return products.filter((product) => {
    const matchesCategory =
      state.activeCategory === "全部" ||
      product.category === state.activeCategory;
    const matchesKeyword =
      normalizedKeyword.length === 0 ||
      product.name.toLowerCase().includes(normalizedKeyword) ||
      product.category.toLowerCase().includes(normalizedKeyword);

    return matchesCategory && matchesKeyword;
  });
});

const cartProductIds = computed(
  () => new Set(state.cartItems.map((item) => item.id)),
);
const memberProfile = computed(() => memberProfiles[state.memberPhone] ?? null);
const discountRate = computed(() => memberProfile.value?.discountRate ?? 1);
const subtotal = computed(() =>
  state.cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0),
);
const totalQuantity = computed(() =>
  state.cartItems.reduce((sum, item) => sum + item.quantity, 0),
);
const memberDiscountAmount = computed(
  () => subtotal.value * (1 - discountRate.value),
);
const afterMemberDiscount = computed(
  () => subtotal.value - memberDiscountAmount.value,
);
const selectedCoupon = computed(
  () =>
    coupons.find((coupon) => coupon.code === state.selectedCouponCode) ??
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
    paymentMethods.find((method) => method.value === state.paymentMethod)
      ?.label ?? "现金",
);
const selectedOrderModeLabel = computed(
  () =>
    orderModes.find((mode) => mode.value === state.orderForm.orderType)
      ?.label ?? "堂食",
);
const selectedTable = computed(
  () =>
    diningTables.find((table) => table.id === state.selectedTableId) ?? null,
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
  () => state.orderForm.orderType === "dine_in" && !selectedTable.value,
);

function addToCart(product: Product) {
  const existing = state.cartItems.find((item) => item.id === product.id);
  if (existing) {
    if (existing.quantity >= product.stock) {
      return;
    }

    existing.quantity += 1;
    return;
  }

  if (product.stock <= 0) {
    return;
  }

  state.cartItems.push({
    ...product,
    quantity: 1,
  });
}

function increaseItem(id: string) {
  const target = state.cartItems.find((item) => item.id === id);
  if (!target || target.quantity >= target.stock) {
    return;
  }

  target.quantity += 1;
}

function decreaseItem(id: string) {
  const target = state.cartItems.find((item) => item.id === id);
  if (!target) {
    return;
  }

  if (target.quantity === 1) {
    state.cartItems = state.cartItems.filter((item) => item.id !== id);
    return;
  }

  target.quantity -= 1;
}

function fillDemoMember() {
  state.memberPhone = "13900139000";
}

function selectTable(tableId: string) {
  const table = diningTables.find((item) => item.id === tableId);
  if (!table || table.occupied) {
    return;
  }

  state.selectedTableId = tableId;
}

function openCheckoutDialog() {
  if (state.cartItems.length === 0) {
    return;
  }

  if (state.orderForm.orderType === "dine_in" && selectedTable.value?.occupied) {
    state.selectedTableId = availableTables.value[0]?.id ?? "";
  }

  state.checkoutDialogOpen = true;
}

function confirmOrder() {
  if (checkoutDisabled.value) {
    return;
  }

  state.checkoutDialogOpen = false;
}

function resetOrder() {
  state.cartItems = [];
  state.memberPhone = "";
  state.selectedCouponCode = "none";
  state.paymentMethod = "cash";
  state.checkoutDialogOpen = false;
  state.selectedTableId = availableTables.value[0]?.id ?? "";
  state.orderForm.remark = "";
}

function isProductInCart(productId: string) {
  return cartProductIds.value.has(productId);
}

function getProductQuantity(productId: string) {
  return state.cartItems.find((item) => item.id === productId)?.quantity ?? 0;
}

export function useOrderStore() {
  return {
    state,
    availableCoupons,
    filteredProducts,
    memberProfile,
    discountRate,
    subtotal,
    totalQuantity,
    memberDiscountAmount,
    selectedCoupon,
    couponDiscountAmount,
    payableAmount,
    selectedPaymentLabel,
    selectedOrderModeLabel,
    selectedTable,
    selectedTableLabel,
    availableTables,
    occupiedTables,
    checkoutDisabled,
    addToCart,
    increaseItem,
    decreaseItem,
    fillDemoMember,
    selectTable,
    openCheckoutDialog,
    confirmOrder,
    resetOrder,
    isProductInCart,
    getProductQuantity,
  };
}
