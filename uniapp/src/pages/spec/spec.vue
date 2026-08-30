<template>
  <Layout :show-tab-bar="false">
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
          :selected-ids="selected[group.id] ?? []"
          @select="selectOption"
        />
        <view v-if="productDetail.optionGroups.length === 0" class="plain">默认规格</view>
        <SpecActionBar :selected-options="selectedOptions" @buy="buyNow" @add="addOnly" />
      </template>
      <view v-else class="empty">未找到餐品</view>
    </view>
  </Layout>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import AppNavBar from "@/components/app/AppNavBar.vue";
import Layout from "@/layout/layout.vue";
import OptionGroup from "@/components/spec/OptionGroup.vue";
import ProductHero from "@/components/spec/ProductHero.vue";
import QuantityStepper from "@/components/spec/QuantityStepper.vue";
import SpecActionBar from "@/components/spec/SpecActionBar.vue";
import { addCartItem } from "@/services/cart";
import { getProductDetail } from "@/services/catalog";
import {
  initializeProductSelections,
  toggleProductSelection,
  validateProductSelections,
  type ProductSelectionState,
} from "@/services/product-selection";
import { buildServiceModeUrl, parseServiceMode } from "@/services/service-mode";
import type { ProductDetail, SelectedOption } from "@/types/menu";
import type { ServiceMode } from "@/types/store";

const quantity = ref(1);
const productDetail = ref<ProductDetail | null>(null);
const selected = reactive<ProductSelectionState>({});
const serviceMode = ref<ServiceMode>("takeaway");

const selectedOptions = computed<SelectedOption[]>(() => {
  if (!productDetail.value) return [];
  return productDetail.value.optionGroups.flatMap((group) => {
    return (selected[group.id] ?? []).flatMap((optionId) => {
      const option = group.options.find((item) => item.id === optionId);
      return option
        ? [{ groupId: group.id, optionId: option.id, name: option.name, imageUrl: option.imageUrl, priceDelta: option.priceDelta }]
        : [];
    });
  });
});

onLoad(async (query) => {
  const id = typeof query?.id === "string" ? query.id : "";
  serviceMode.value = parseServiceMode(query?.mode) ?? "takeaway";
  try {
    productDetail.value = await getProductDetail(id);
    if (productDetail.value) {
      Object.assign(selected, initializeProductSelections(productDetail.value.optionGroups));
    }
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : "商品加载失败", icon: "none" });
  }
});

function selectOption(groupId: string, optionId: string) {
  const group = productDetail.value?.optionGroups.find((item) => item.id === groupId);
  if (!group) return;
  const result = toggleProductSelection(group, selected[groupId] ?? [], optionId);
  if (result.limitReached) {
    uni.showToast({ title: `${group.name}最多选择 ${group.max} 项`, icon: "none" });
    return;
  }
  selected[groupId] = result.selected;
}

function addToCart() {
  if (!productDetail.value) return false;
  const selectionError = validateProductSelections(productDetail.value.optionGroups, selected);
  if (selectionError) {
    uni.showToast({ title: selectionError, icon: "none" });
    return false;
  }
  addCartItem(productDetail.value, quantity.value, selectedOptions.value);
  uni.showToast({ title: "已加入购物车", icon: "success" });
  return true;
}

function buyNow() {
  if (addToCart()) {
    uni.navigateTo({
      url: buildServiceModeUrl("/pages/checkout/checkout", serviceMode.value),
    });
  }
}

function addOnly() {
  if (addToCart()) {
    uni.redirectTo({ url: buildServiceModeUrl("/pages/order/order", serviceMode.value) });
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
