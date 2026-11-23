<template>
  <Layout :show-tab-bar="false">
    <template #header>
      <AppNavBar title="商品规格" show-back @back="goBack" />
    </template>
    <view class="spec-content" :class="{ 'spec-without-action': !productDetail }">
      <template v-if="productDetail">
        <ProductHero :product="productDetail" />
        <view class="info">
          <view class="product-info">
            <text class="name">{{ productDetail.name }}</text>
            <text v-if="productDetail.description" class="tag">{{ productDetail.description }}</text>
            <PriceText :price="selectionPrice" />
          </view>
          <QuantityStepper v-model="quantity" />
        </view>
        <view v-if="productDetail.variants && productDetail.variants.length > 1" class="variants">
          <text class="variants-label">规格</text>
          <view class="variant-options">
            <button v-for="variant in productDetail.variants" :key="variant.id"
              class="variant-option" :class="{ 'variant-active': productDetail.skuId === variant.id }"
              :aria-pressed="productDetail.skuId === variant.id" @tap="selectVariant(variant)" @keydown.enter="selectVariant(variant)">
              {{ variant.name }}
            </button>
          </view>
        </view>
        <OptionGroup
          v-for="group in productDetail.optionGroups"
          :key="group.id"
          :group="group"
          :selected-ids="selected[group.id] ?? []"
          @select="selectOption"
        />
      </template>
      <view v-else class="empty">
        <text>{{ loading ? "正在加载餐品…" : loadError || "未找到餐品" }}</text>
        <AppActionButton v-if="loadError" size="small" variant="outline" @activate="loadProduct">重试</AppActionButton>
      </view>
    </view>
    <template #footer>
      <SpecActionBar v-if="productDetail" :selected-options="selectedOptions" :disabled="!productDetail.skuId || addingToCart" @buy="buyNow" @add="addOnly" />
    </template>
  </Layout>
</template>

<script setup lang="ts">
import { navigateBackOrRedirect } from "@/services/auth-navigation";
import { computed, reactive, ref } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import AppNavBar from "@/components/app/AppNavBar.vue";
import AppActionButton from "@/components/app/AppActionButton.vue";
import PriceText from "@/components/app/PriceText.vue";
import Layout from "@/layout/layout.vue";
import OptionGroup from "@/components/spec/OptionGroup.vue";
import ProductHero from "@/components/spec/ProductHero.vue";
import QuantityStepper from "@/components/app/QuantityStepper.vue";
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

const orderPath = "/pages/order/order";
const quantity = ref(1);
const productDetail = ref<ProductDetail | null>(null);
const productId = ref("");
const loading = ref(false);
const loadError = ref("");
const addingToCart = ref(false);
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

const selectionPrice = computed(() =>
  (productDetail.value?.price ?? 0) + selectedOptions.value.reduce((sum, entry) => sum + (entry.priceDelta ?? 0), 0));

onLoad((query) => {
  productId.value = typeof query?.id === "string" ? query.id : "";
  serviceMode.value = parseServiceMode(query?.mode) ?? "takeaway";
  void loadProduct();
});

async function loadProduct() {
  loading.value = true;
  loadError.value = "";
  try {
    productDetail.value = await getProductDetail(productId.value);
    if (productDetail.value) {
      Object.assign(selected, initializeProductSelections(productDetail.value.optionGroups));
    }
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : "商品加载失败";
  } finally {
    loading.value = false;
  }
}

function selectVariant(variant: NonNullable<ProductDetail["variants"]>[number]) {
  const previous = productDetail.value;
  if (!previous || variant.id === previous.skuId) return;
  const defaults = initializeProductSelections(variant.optionGroups);
  const nextSelections = Object.fromEntries(variant.optionGroups.map((group) => {
    const kept = selected[group.id]?.filter((id) => group.options.some((option) => option.id === id)) ?? [];
    return [group.id, kept.length >= group.min && kept.length <= group.max ? kept : defaults[group.id]];
  }));
  for (const groupId of Object.keys(selected)) delete selected[groupId];
  Object.assign(selected, nextSelections);
  productDetail.value = { ...previous, skuId: variant.id, skuName: variant.name, price: variant.price, optionGroups: variant.optionGroups };
}

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
  try {
    addCartItem(productDetail.value, quantity.value, selectedOptions.value);
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : "无法加入购物车", icon: "none" });
    return false;
  }
  return true;
}

function buyNow() {
  if (!addingToCart.value && addToCart()) {
    uni.navigateTo({
      url: buildServiceModeUrl("/pages/checkout/checkout", serviceMode.value),
    });
  }
}

function addOnly() {
  if (addingToCart.value || !addToCart()) return;
  addingToCart.value = true;

  const showAdded = () => uni.showToast({ title: "已加入购物车", icon: "success" });
  const openOrderPage = () => uni.redirectTo({
    url: buildServiceModeUrl(orderPath, serviceMode.value),
    success: showAdded,
    fail: () => {
      addingToCart.value = false;
      uni.showToast({ title: "已加入购物车，请前往点单页查看", icon: "none" });
    },
  });

  const pages = getCurrentPages();
  const previousPage = pages[pages.length - 2];
  if (previousPage?.route === orderPath.slice(1)) {
    uni.navigateBack({ success: showAdded, fail: openOrderPage });
  } else {
    openOrderPage();
  }
}

function goBack() {
  navigateBackOrRedirect(buildServiceModeUrl(orderPath, serviceMode.value));
}
</script>

<style scoped>
.spec-content {
  min-height: 100%;
  padding: var(--ld-page-padding, 24rpx) 0 12rpx;
  background: var(--ld-mini-surface);
}

.spec-without-action {
  padding-bottom: var(--ld-page-bottom-safe);
}

.info {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20rpx;
  padding: 26rpx var(--ld-page-padding, 24rpx) 34rpx;
}

.product-info { min-width: 0; }

.name {
  display: block;
  margin-bottom: 8rpx;
  color: var(--ld-mini-text);
  font-size: var(--ld-font-display, 40rpx);
  font-weight: 750;
  overflow-wrap: anywhere;
}

.tag {
  display: block;
  margin-bottom: 14rpx;
  color: var(--ld-mini-text-muted);
  font-size: var(--ld-font-sm);
  line-height: 1.5;
}

.variants {
  padding: 0 var(--ld-page-padding) 24rpx;
}

.variants-label {
  display: block;
  margin-bottom: 12rpx;
  font-weight: 650;
}

.variant-options {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.variant-option {
  min-height: 80rpx;
  margin: 0;
  padding: 0 24rpx;
  border: 1rpx solid var(--ld-mini-border);
  border-radius: var(--ld-radius-8);
  background: var(--ld-mini-surface);
  color: var(--ld-mini-text);
  font-size: var(--ld-font-base);
  line-height: 78rpx;
}

.variant-option::after { border: 0; }
.variant-active {
  border-color: var(--ld-mini-primary);
  background: var(--ld-mini-primary-soft);
  color: var(--ld-mini-primary-pressed);
}

.empty {
  display: grid;
  align-content: center;
  justify-items: center;
  gap: 16rpx;
  min-height: 180rpx;
  color: var(--ld-mini-text-muted);
}
</style>
