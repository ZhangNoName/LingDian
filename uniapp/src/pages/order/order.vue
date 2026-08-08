<template>
  <Layout active="menu">
    <view class="page">
      <AppNavBar title="点单" />
      <StoreHeader :store="store" />
      <view class="menu-layout">
        <CategorySidebar :categories="menuCategories" :active-id="activeCategoryId" @select="handleCategorySelect" />
        <scroll-view
          class="product-list"
          scroll-y
          scroll-with-animation
          :scroll-into-view="scrollIntoView"
          @scroll="handleProductScroll"
        >
          <view v-if="menuState === 'loading'" class="menu-state menu-state--loading" aria-live="polite">
            <SkeletonBox class="loading-title" radius="sm" />
            <SkeletonBox v-for="index in 3" :key="index" class="loading-item" radius="lg" />
          </view>
          <view v-else-if="menuState === 'error'" class="menu-state">
            <text class="state-title">菜单加载失败</text>
            <text class="state-copy">暂时无法加载菜单，请检查网络后重试</text>
            <button class="retry-button" role="button" tabindex="0" aria-label="重新加载菜单" @keydown.enter="retryLoadMenu" @tap="retryLoadMenu">重新加载</button>
          </view>
          <view v-else-if="menuState === 'empty'" class="menu-state menu-state--empty">
            <image class="empty-logo" src="/static/logo-xsf-red-yellow.png" mode="aspectFit" aria-label="零食坊品牌标志" />
            <text class="state-title">暂无可售餐品</text>
            <text class="state-copy">餐品正在准备中，稍后再来看看吧</text>
          </view>
          <template v-else>
            <view v-for="section in menuSections" :id="getSectionDomId(section.category.id)" :key="section.category.id" class="product-section">
              <view class="section-title">
                <text>{{ section.category.name }}</text>
              </view>
              <MenuProductItem v-for="product in section.products" :key="product.id" :product="product" @select="goSpec" />
            </view>
          </template>
        </scroll-view>
      </view>
      <CartCheckoutBar :cart="cartSummary" @checkout="goCheckout" />
    </view>
  </Layout>
</template>

<script setup lang="ts">
import { computed, getCurrentInstance, nextTick, ref } from "vue";
import { onLoad, onShow, onUnload } from "@dcloudio/uni-app";
import AppNavBar from "@/components/app/AppNavBar.vue";
import CartCheckoutBar from "@/components/menu/CartCheckoutBar.vue";
import CategorySidebar from "@/components/menu/CategorySidebar.vue";
import MenuProductItem from "@/components/menu/MenuProductItem.vue";
import StoreHeader from "@/components/menu/StoreHeader.vue";
import SkeletonBox from "@/components/app/SkeletonBox.vue";
import Layout from "@/layout/layout.vue";
import { fetchMenu, type MenuViewModel } from "@/services/catalog";
import { getCartSummary } from "@/services/cart";
import { requireCustomerAuth } from "@/services/auth-navigation";
import { canCheckout } from "@/services/checkout-state";
import { resolveMenuViewState, type MenuViewState } from "@/services/menu-view-state";
import type { CartSummary } from "@/types/cart";
import type { StoreSummary } from "@/types/store";

const menu = ref<MenuViewModel | null>(null);
const loading = ref(false);
const failed = ref(false);
const activeCategoryId = ref("");
const scrollIntoView = ref("");
const sectionOffsets = ref<Array<{ id: string; top: number }>>([]);
const scrollMetrics = ref({ viewportHeight: 0, contentHeight: 0 });
const isCategoryJumping = ref(false);
const cartSummary = ref<CartSummary>(getCartSummary());
const instance = getCurrentInstance();
let initialMeasureTimer: ReturnType<typeof setTimeout> | undefined;
let categoryJumpTimer: ReturnType<typeof setTimeout> | undefined;

const fallbackStore: StoreSummary = {
  id: "",
  name: "零点点餐",
  address: "正在加载门店",
  distanceText: "当前门店",
  businessStatus: "open",
  supportModes: ["dineIn", "takeaway"],
};

const store = computed(() => menu.value?.store ?? fallbackStore);
const menuCategories = computed(() => menu.value?.categories ?? []);
const products = computed(() => menu.value?.products ?? []);

const productsByCategory = computed(() => {
  return products.value.reduce<Record<string, typeof products.value>>((groups, product) => {
    groups[product.categoryId] = groups[product.categoryId] || [];
    groups[product.categoryId].push(product);
    return groups;
  }, {});
});

const menuSections = computed(() => {
  return menuCategories.value
    .map((category) => ({
      category,
      products: productsByCategory.value[category.id] || [],
    }))
    .filter((section) => section.products.length > 0);
});

const menuState = computed<MenuViewState>(() =>
  resolveMenuViewState({
    loading: loading.value,
    failed: failed.value,
    sectionCount: menuSections.value.length,
  }),
);

onLoad(loadMenu);

onShow(() => {
  cartSummary.value = getCartSummary();
});

onUnload(() => {
  if (initialMeasureTimer) clearTimeout(initialMeasureTimer);
  if (categoryJumpTimer) clearTimeout(categoryJumpTimer);
});

async function loadMenu() {
  loading.value = true;
  failed.value = false;
  try {
    menu.value = await fetchMenu();
    activeCategoryId.value = menu.value.categories[0]?.id ?? "";
    nextTick(() => {
      measureSectionOffsets();
      initialMeasureTimer = setTimeout(measureSectionOffsets, 300);
    });
  } catch (error) {
    failed.value = true;
    uni.showToast({ title: error instanceof Error ? error.message : "菜单加载失败", icon: "none" });
  } finally {
    loading.value = false;
  }
}

async function retryLoadMenu() {
  if (loading.value) return;
  await loadMenu();
}

function getSectionDomId(categoryId: string) {
  return `category-${categoryId}`;
}

function handleCategorySelect(categoryId: string) {
  activeCategoryId.value = categoryId;
  isCategoryJumping.value = true;
  scrollIntoView.value = "";
  nextTick(() => {
    scrollIntoView.value = getSectionDomId(categoryId);
  });

  if (categoryJumpTimer) clearTimeout(categoryJumpTimer);
  categoryJumpTimer = setTimeout(() => {
    isCategoryJumping.value = false;
  }, 700);
}

function handleProductScroll(event: { detail: { scrollTop: number } }) {
  if (isCategoryJumping.value) return;

  const maxScrollTop = Math.max(0, scrollMetrics.value.contentHeight - scrollMetrics.value.viewportHeight);
  const isNearBottom = event.detail.scrollTop >= maxScrollTop - 12;
  if (isNearBottom && sectionOffsets.value.length) {
    activeCategoryId.value = sectionOffsets.value[sectionOffsets.value.length - 1].id;
    return;
  }

  const currentOffset = sectionOffsets.value.reduce((current, item) => {
    return event.detail.scrollTop + 16 >= item.top ? item : current;
  }, sectionOffsets.value[0]);

  if (currentOffset && activeCategoryId.value !== currentOffset.id) {
    activeCategoryId.value = currentOffset.id;
  }
}

function measureSectionOffsets() {
  const query = uni.createSelectorQuery().in(instance?.proxy);
  query.select(".product-list").boundingClientRect();
  query.selectAll(".product-section").boundingClientRect();
  query.exec((result) => {
    const listRect = result[0] as UniApp.NodeInfo | null;
    const sectionRects = (result[1] || []) as UniApp.NodeInfo[];
    if (!listRect || !sectionRects.length) return;

    sectionOffsets.value = sectionRects
      .filter((rect) => typeof rect.id === "string" && typeof rect.top === "number")
      .map((rect) => ({
        id: String(rect.id).replace(/^category-/, ""),
        top: Math.max(0, Number(rect.top) - Number(listRect.top)),
      }));
    scrollMetrics.value = {
      viewportHeight: Number(listRect.height || 0),
      contentHeight: sectionRects.reduce((height, rect) => {
        if (typeof rect.bottom !== "number") return height;
        return Math.max(height, Number(rect.bottom) - Number(listRect.top));
      }, 0),
    };
  });
}

function goSpec(productId: string) {
  uni.navigateTo({ url: `/pages/spec/spec?id=${productId}` });
}

async function goCheckout() {
  if (!canCheckout(cartSummary.value)) {
    uni.showToast({ title: "请先选择餐品", icon: "none" });
    return;
  }
  if (!(await requireCustomerAuth("/pages/checkout/checkout"))) return;
  uni.navigateTo({ url: "/pages/checkout/checkout" });
}
</script>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  height: 100%;
  padding-bottom: calc(112rpx + var(--ld-page-padding, 24rpx));
  overflow: hidden;
  background: #ffffff;
}

.menu-layout {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 156rpx minmax(0, 1fr);
  overflow: hidden;
}

.product-list {
  box-sizing: border-box;
  height: 100%;
  min-height: 0;
  padding: 0 24rpx 24rpx 28rpx;
  overflow: hidden;
  background: #ffffff;
}

.menu-state {
  display: grid;
  min-height: 480rpx;
  align-content: center;
  justify-items: center;
  gap: 16rpx;
  padding: 48rpx 24rpx;
  text-align: center;
}

.menu-state--loading {
  align-content: start;
  gap: 20rpx;
  padding-top: 32rpx;
}

.loading-title,
.loading-item {
  width: 100%;
}

.loading-title {
  width: 168rpx;
  height: 32rpx;
  justify-self: start;
}

.loading-item {
  height: 168rpx;
}

.menu-state--empty {
  gap: 14rpx;
}

.empty-logo {
  width: 112rpx;
  height: 112rpx;
  margin-bottom: 8rpx;
}

.state-title {
  color: var(--ld-mini-text);
  font-size: var(--ld-font-title, 32rpx);
  font-weight: 800;
}

.state-copy {
  color: var(--ld-mini-text-muted);
  font-size: var(--ld-font-sm, 24rpx);
}

.retry-button {
  height: 68rpx;
  margin: 12rpx 0 0;
  padding: 0 32rpx;
  border-radius: 999rpx;
  background: var(--ld-mini-primary);
  color: #ffffff;
  font-size: var(--ld-font-sm, 24rpx);
  font-weight: 800;
  line-height: 68rpx;
}

.retry-button::after {
  border: 0;
}

.product-section {
  min-height: 100rpx;
}

.section-title {
  display: flex;
  align-items: center;
  min-height: 56rpx;
  color: var(--ld-mini-text-muted);
  font-size: 24rpx;
  font-weight: 700;
}

</style>

