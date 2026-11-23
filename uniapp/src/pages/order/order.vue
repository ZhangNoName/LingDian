<template>
  <Layout active="menu" :scroll-content="false" :content-inert="cartOpen">
    <template #header>
      <AppNavBar title="点单" />
      <StoreHeader v-if="menu" :store="menu.store" :service-mode="serviceMode" />
    </template>
    <view class="menu-layout">
      <CategorySidebar :categories="menuCategories" :active-id="activeCategoryId" @select="handleCategorySelect" />
      <scroll-view
        class="product-list"
        scroll-y
        scroll-with-animation
        :lower-threshold="320"
        :scroll-into-view="scrollIntoView"
        @scroll="handleProductScroll"
        @scrolltolower="loadMoreProducts"
      >
        <view v-if="menuState === 'loading'" class="menu-state menu-state--loading" aria-live="polite">
          <SkeletonBox class="loading-title" radius="sm" />
          <SkeletonBox v-for="index in 3" :key="index" class="loading-item" radius="lg" />
        </view>
        <view v-else-if="menuState === 'error'" class="menu-state">
          <text class="state-title">菜单加载失败</text>
          <text class="state-copy">暂时无法加载菜单，请检查网络后重试</text>
          <AppActionButton @activate="retryLoadMenu">重新加载</AppActionButton>
        </view>
        <view v-else-if="menuState === 'empty'" class="menu-state menu-state--empty">
          <image class="empty-logo" src="/static/logo-xsf-red-yellow.png" mode="aspectFit" lazy-load aria-label="零食坊品牌标志" />
          <text class="state-title">暂无可售餐品</text>
          <text class="state-copy">餐品正在准备中，稍后再来看看吧</text>
        </view>
        <template v-else>
          <view v-for="section in visibleMenuSections" :id="getSectionDomId(section.category.id)" :key="section.category.id" class="product-section">
            <view class="section-title">
              <text>{{ section.category.name }}</text>
            </view>
            <MenuProductItem
              v-for="product in section.products"
              :key="product.id"
              :product="product"
              :quantity="productQuantity(product)"
              @select="goSpec"
              @quantity="changeProductQuantity"
            />
          </view>
        </template>
      </scroll-view>
    </view>
    <template #footer>
      <CartCheckoutBar v-if="hasCart" :cart="cartSummary" @open-cart="cartOpen = true" @checkout="goCheckout" />
    </template>
    <template #overlay>
      <CartDrawer
        v-if="hasCart && cartOpen"
        :cart="cartSummary"
        @close="cartOpen = false"
        @clear="clearCartContents"
        @quantity="updateCartQuantity"
        @checkout="goCheckout"
      />
    </template>
  </Layout>
</template>

<script setup lang="ts">
import AppActionButton from "@/components/app/AppActionButton.vue";
import { computed, getCurrentInstance, nextTick, ref, shallowRef, watch } from "vue";
import { onLoad, onReady, onShow, onUnload } from "@dcloudio/uni-app";
import AppNavBar from "@/components/app/AppNavBar.vue";
import CartCheckoutBar from "@/components/menu/CartCheckoutBar.vue";
import CartDrawer from "@/components/menu/CartDrawer.vue";
import CategorySidebar from "@/components/menu/CategorySidebar.vue";
import MenuProductItem from "@/components/menu/MenuProductItem.vue";
import StoreHeader from "@/components/menu/StoreHeader.vue";
import SkeletonBox from "@/components/app/SkeletonBox.vue";
import Layout from "@/layout/layout.vue";
import { fetchMenu, peekMenu } from "@/services/catalog";
import { addCartItem, cartLineId, clearCart, getCartSummary, setCartQuantity } from "@/services/cart";
import { requireCustomerAuth } from "@/services/auth-navigation";
import { canCheckout } from "@/services/checkout-state";
import { resolveMenuViewState, type MenuViewState } from "@/services/menu-view-state";
import { buildServiceModeUrl, parseServiceMode } from "@/services/service-mode";
import type { CartSummary } from "@/types/cart";
import type { ProductSummary } from "@/types/menu";
import type { ServiceMode } from "@/types/store";

const MENU_BATCH_SIZE = 12;
const menu = shallowRef(peekMenu());
const visibleProductCount = ref(MENU_BATCH_SIZE);
const loading = ref(false);
const failed = ref(false);
const activeCategoryId = ref("");
const scrollIntoView = ref("");
const sectionOffsets = ref<Array<{ id: string; top: number }>>([]);
const scrollMetrics = ref({ viewportHeight: 0, contentHeight: 0 });
let productScrollTop = 0;
const isCategoryJumping = ref(false);
const cartSummary = ref<CartSummary>(getCartSummary());
const cartOpen = ref(false);
const hasCart = computed(() => canCheckout(cartSummary.value));
const serviceMode = ref<ServiceMode>("takeaway");
const instance = getCurrentInstance();
let categoryJumpTimer: ReturnType<typeof setTimeout> | undefined;

const menuCategories = computed(() => menu.value?.categories ?? []);
const products = computed(() => menu.value?.products ?? []);
const cartQuantities = computed(() => new Map(cartSummary.value.items.map(({ id, quantity }) => [id, quantity])));

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

const visibleMenuSections = computed(() => {
  let remaining = visibleProductCount.value;
  return menuSections.value.flatMap((section) => {
    if (remaining <= 0) return [];
    const visibleProducts = section.products.slice(0, remaining);
    remaining -= visibleProducts.length;
    return [{ category: section.category, products: visibleProducts }];
  });
});

const menuState = computed<MenuViewState>(() =>
  resolveMenuViewState({
    loading: loading.value && !menu.value,
    failed: failed.value,
    sectionCount: menuSections.value.length,
  }),
);

onLoad((query) => {
  serviceMode.value = parseServiceMode(query?.mode) ?? "takeaway";
  ensureActiveCategory();
  void loadMenu();
});

onReady(measureSectionOffsets);

onShow(() => {
  cartOpen.value = false;
  cartSummary.value = getCartSummary();
});

watch(hasCart, (hasItems) => {
  if (!hasItems) cartOpen.value = false;
});

watch([hasCart, visibleMenuSections], () => {
  void nextTick(measureSectionOffsets);
});

onUnload(() => {
  if (categoryJumpTimer) clearTimeout(categoryJumpTimer);
});

function ensureActiveCategory() {
  if (!menuSections.value.some((section) => section.category.id === activeCategoryId.value)) {
    activeCategoryId.value = menuSections.value[0]?.category.id ?? "";
  }
}

async function loadMenu() {
  loading.value = true;
  failed.value = false;
  try {
    menu.value = await fetchMenu();
    const { supportModes } = menu.value.store;
    if (!supportModes.includes(serviceMode.value)) {
      serviceMode.value = supportModes[0] ?? "takeaway";
    }
    ensureActiveCategory();
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

function loadMoreProducts() {
  if (visibleProductCount.value >= products.value.length) return;
  visibleProductCount.value = Math.min(visibleProductCount.value + MENU_BATCH_SIZE, products.value.length);
}

function handleCategorySelect(categoryId: string) {
  const index = menuSections.value.findIndex((section) => section.category.id === categoryId);
  if (index < 0) return;
  const beforeCategory = menuSections.value.slice(0, index).reduce((total, section) => total + section.products.length, 0);
  visibleProductCount.value = Math.max(visibleProductCount.value, Math.min(beforeCategory + MENU_BATCH_SIZE, products.value.length));
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
  productScrollTop = event.detail.scrollTop;
  if (isCategoryJumping.value) return;

  const maxScrollTop = Math.max(0, scrollMetrics.value.contentHeight - scrollMetrics.value.viewportHeight);
  const isNearBottom = maxScrollTop > 12 && event.detail.scrollTop >= maxScrollTop - 12;
  if (isNearBottom && visibleProductCount.value >= products.value.length && sectionOffsets.value.length) {
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
        top: Math.max(0, Number(rect.top) - Number(listRect.top) + productScrollTop),
      }));
    scrollMetrics.value = {
      viewportHeight: Number(listRect.height || 0),
      contentHeight: sectionRects.reduce((height, rect) => {
        if (typeof rect.bottom !== "number") return height;
        return Math.max(height, Number(rect.bottom) - Number(listRect.top) + productScrollTop);
      }, 0),
    };
    if (scrollMetrics.value.contentHeight <= scrollMetrics.value.viewportHeight) loadMoreProducts();
  });
}

function productQuantity(product: ProductSummary): number {
  if (product.hasSpec || !product.skuId) return 0;
  return cartQuantities.value.get(cartLineId(product.id, product.skuId, [])) ?? 0;
}

function changeProductQuantity(productId: string, quantity: number) {
  const product = menu.value?.productDetails[productId];
  if (!product?.skuId || product.hasSpec) return;

  const lineId = cartLineId(product.id, product.skuId, []);
  try {
    cartSummary.value = cartQuantities.value.has(lineId) || quantity === 0
      ? setCartQuantity(lineId, quantity)
      : addCartItem(product, quantity, []);
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : "无法更新购物车", icon: "none" });
  }
}

function updateCartQuantity(id: string, quantity: number) {
  cartSummary.value = setCartQuantity(id, quantity);
}

function clearCartContents() {
  clearCart();
  cartSummary.value = getCartSummary();
}

function goSpec(productId: string) {
  uni.navigateTo({
    url: buildServiceModeUrl("/pages/spec/spec", serviceMode.value, { id: productId }),
  });
}

async function goCheckout() {
  if (!hasCart.value) return;
  cartOpen.value = false;
  const checkoutUrl = buildServiceModeUrl("/pages/checkout/checkout", serviceMode.value);
  if (!(await requireCustomerAuth()) || !hasCart.value) return;
  uni.navigateTo({ url: checkoutUrl });
}
</script>

<style scoped>
.menu-layout {
  height: 100%;
  display: grid;
  grid-template-columns: 156rpx minmax(0, 1fr);
  overflow: hidden;
}

.product-list {
  box-sizing: border-box;
  height: 100%;
  min-height: 0;
  padding: 0 20rpx 12rpx;
  overflow: hidden;
  background: var(--ld-mini-bg);
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
