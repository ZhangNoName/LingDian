<template>
  <div
    class="grid h-full min-h-0 gap-5 overflow-hidden xl:grid-cols-[1.5fr_0.95fr]"
  >
    <div class="flex flex-col gap-2">
      <div class="shrink-0">
        <Input
          :model-value="state.keyword"
          placeholder="搜索商品 / 分类 / 规格"
          class="rounded-md"
          @update:model-value="state.keyword = String($event)"
        />
      </div>

      <div class="flex shrink-0 flex-wrap gap-2">
        <Button
          v-for="category in categories"
          :key="category"
          :variant="state.activeCategory === category ? 'default' : 'outline'"
          class="rounded-md cursor-pointer hover:bg-blue-200"
          @click="state.activeCategory = category"
        >
          {{ category }}
        </Button>
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto pr-1">
        <div v-if="loadingProducts" class="py-16 text-center text-sm text-muted-foreground">
          正在加载商品...
        </div>
        <div v-else class="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          <OrderProductCard
            v-for="product in filteredProducts"
            :key="product.id"
            :in-cart="isProductInCart(product.id)"
            :product="product"
            :quantity="getProductQuantity(product.id)"
            @add="addToCart"
            @decrease="decreaseItem"
            @increase="increaseItem"
          />
        </div>
      </div>
    </div>

    <OrderCheckoutPanel
      v-model:member-phone="state.memberPhone"
      v-model:remark="state.orderForm.remark"
      v-model:selected-coupon-code="state.selectedCouponCode"
      :available-coupons="availableCoupons"
      :cart-items="state.cartItems"
      :coupon-discount-amount="couponDiscountAmount"
      :discount-rate="discountRate"
      :member-discount-amount="memberDiscountAmount"
      :member-profile="memberProfile"
      :payable-amount="payableAmount"
      :selected-coupon="selectedCoupon"
      :subtotal="subtotal"
      :table-label="
        state.orderForm.orderType === 'dine_in' ? selectedTableLabel : '无需桌台'
      "
      @decrease-item="decreaseItem"
      @fill-demo-member="fillDemoMember"
      @increase-item="increaseItem"
      @open-checkout="openCheckoutDialog"
      @reset-order="resetOrder"
    />

    <OrderConfirmDialog
      v-model:open="state.checkoutDialogOpen"
      v-model:payment-method="state.paymentMethod"
      :available-tables="availableTables"
      :checkout-disabled="checkoutDisabled"
      :coupon-discount-amount="couponDiscountAmount"
      :dining-tables="diningTables"
      :member-discount-amount="memberDiscountAmount"
      :occupied-tables="occupiedTables"
      :order-form="state.orderForm"
      :payable-amount="payableAmount"
      :payment-methods="paymentMethods"
      :selected-order-mode-label="selectedOrderModeLabel"
      :selected-payment-label="selectedPaymentLabel"
      :selected-table-id="state.selectedTableId"
      :selected-table-label="selectedTableLabel"
      :subtotal="subtotal"
      :total-quantity="totalQuantity"
      @confirm-order="confirmOrder"
      @select-table="selectTable"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from "vue";
import { Button } from "@/baseComponents/button";
import { Input } from "@/baseComponents/input";
import { useOrderStore } from "@/stores/order";
import OrderCheckoutPanel from "./components/OrderCheckoutPanel.vue";
import OrderConfirmDialog from "./components/OrderConfirmDialog.vue";
import OrderProductCard from "./components/OrderProductCard.vue";
import { diningTables, paymentMethods } from "./mock";

const {
  state,
  categories,
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
  selectedTableLabel,
  availableTables,
  occupiedTables,
  checkoutDisabled,
  loadingProducts,
  initialize,
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
} = useOrderStore();

onMounted(() => {
  void initialize();
});
</script>
