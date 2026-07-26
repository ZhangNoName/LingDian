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
          <view v-for="section in menuSections" :id="getSectionDomId(section.category.id)" :key="section.category.id" class="product-section">
            <view class="section-title">
              <text>{{ section.category.name }}</text>
            </view>
            <MenuProductItem v-for="product in section.products" :key="product.id" :product="product" @select="goSpec" />
          </view>
          <view v-if="menuSections.length === 0" class="empty">暂无可售餐品</view>
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
import Layout from "@/layout/layout.vue";
import { fetchMenu, type MenuViewModel } from "@/services/catalog";
import { getCartSummary } from "@/services/cart";
import { requireCustomerAuth } from "@/services/auth-navigation";
import { canCheckout } from "@/services/checkout-state";
import type { CartSummary } from "@/types/cart";
import type { StoreSummary } from "@/types/store";

const menu = ref<MenuViewModel | null>(null);
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

onLoad(loadMenu);

onShow(() => {
  cartSummary.value = getCartSummary();
});

onUnload(() => {
  if (initialMeasureTimer) clearTimeout(initialMeasureTimer);
  if (categoryJumpTimer) clearTimeout(categoryJumpTimer);
});

async function loadMenu() {
  try {
    menu.value = await fetchMenu();
    activeCategoryId.value = menu.value.categories[0]?.id ?? "";
    nextTick(() => {
      measureSectionOffsets();
      initialMeasureTimer = setTimeout(measureSectionOffsets, 300);
    });
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : "菜单加载失败", icon: "none" });
  }
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
  padding-bottom: calc(var(--ld-fixed-action-height, 128rpx) + var(--ld-page-bottom-safe, 24rpx));
  overflow: hidden;
  background: #ffffff;
}

.menu-layout {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 156rpx 1fr;
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

.empty {
  display: grid;
  place-items: center;
  min-height: 320rpx;
  color: var(--ld-mini-text-muted);
}
</style>

