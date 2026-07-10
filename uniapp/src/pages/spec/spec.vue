<template>
  <view class="page">
    <AppNavBar show-back @back="goBack" />
    <template v-if="productDetail">
      <ProductHero :product="productDetail" />
      <view class="info">
        <view>
          <text class="name">{{ productDetail.name }}</text>
          <text v-if="productDetail.description" class="tag">{{ productDetail.description }}</text>
        </view>
        <QuantityStepper v-model="quantity" />
      </view>
      <OptionGroup
        v-for="group in productDetail.optionGroups"
        :key="group.id"
        :group="group"
        :selected-id="selected[group.id]"
        @select="selectOption"
      />
      <view v-if="productDetail.optionGroups.length === 0" class="plain">默认规格</view>
      <SpecActionBar :selected-options="selectedOptions" @buy="buyNow" @add="addOnly" />
    </template>
    <view v-else class="empty">未找到餐品</view>
  </view>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import AppNavBar from "@/components/app/AppNavBar.vue";
import OptionGroup from "@/components/spec/OptionGroup.vue";
import ProductHero from "@/components/spec/ProductHero.vue";
import QuantityStepper from "@/components/spec/QuantityStepper.vue";
import SpecActionBar from "@/components/spec/SpecActionBar.vue";
import { addCartItem } from "@/services/cart";
import { getProductDetail } from "@/services/catalog";
import type { ProductDetail, SelectedOption } from "@/types/menu";

const quantity = ref(1);
const productDetail = ref<ProductDetail | null>(null);
const selected = reactive<Record<string, string>>({});

const selectedOptions = computed<SelectedOption[]>(() => {
  if (!productDetail.value) return [];
  return productDetail.value.optionGroups.flatMap((group) => {
    const optionId = selected[group.id];
    const option = group.options.find((item) => item.id === optionId);
    return option
      ? [{ groupId: group.id, optionId: option.id, name: option.name, imageUrl: option.imageUrl, priceDelta: option.priceDelta }]
      : [];
  });
});

onLoad(async (query) => {
  const id = typeof query?.id === "string" ? query.id : "";
  productDetail.value = await getProductDetail(id);
  productDetail.value?.optionGroups.forEach((group) => {
    selected[group.id] = group.options[0]?.id ?? "";
  });
});

function selectOption(groupId: string, optionId: string) {
  selected[groupId] = optionId;
}

function addToCart() {
  if (!productDetail.value) return false;
  addCartItem(productDetail.value, quantity.value, selectedOptions.value);
  uni.showToast({ title: "已加入购物车", icon: "success" });
  return true;
}

function buyNow() {
  if (addToCart()) {
    uni.navigateTo({ url: "/pages/checkout/checkout" });
  }
}

function addOnly() {
  if (addToCart()) {
    uni.redirectTo({ url: "/pages/order/order" });
  }
}

function goBack() {
  uni.navigateBack();
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  padding-bottom: calc(var(--ld-fixed-action-height, 128rpx) + var(--ld-page-bottom-safe, 24rpx));
  background: #ffffff;
}

.info {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 26rpx var(--ld-page-padding, 24rpx) 34rpx;
}

.name {
  display: block;
  margin-bottom: 14rpx;
  color: var(--ld-mini-text);
  font-size: var(--ld-font-display, 40rpx);
  font-weight: 900;
}

.tag {
  display: inline-flex;
  padding: 4rpx 10rpx;
  border: 1rpx solid #f3a1a6;
  color: var(--ld-mini-primary);
  font-size: var(--ld-font-xs, 22rpx);
}

.plain,
.empty {
  display: grid;
  place-items: center;
  min-height: 180rpx;
  color: var(--ld-mini-text-muted);
}
</style>

