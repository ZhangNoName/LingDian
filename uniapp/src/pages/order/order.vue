<template>
  <view class="page">
    <AppNavBar show-back show-search @back="goHome" />
    <StoreHeader :store="currentStore" />
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
      </scroll-view>
    </view>
    <CartCheckoutBar :cart="cartSummary" @checkout="goCheckout" />
  </view>
</template>

<script setup lang="ts">
import { computed, getCurrentInstance, nextTick, onMounted, onUnmounted, ref } from "vue";
import AppNavBar from "@/components/app/AppNavBar.vue";
import CartCheckoutBar from "@/components/menu/CartCheckoutBar.vue";
import CategorySidebar from "@/components/menu/CategorySidebar.vue";
import MenuProductItem from "@/components/menu/MenuProductItem.vue";
import StoreHeader from "@/components/menu/StoreHeader.vue";
import { cartSummary, currentStore, menuCategories, products } from "@/data/mock";

const activeCategoryId = ref(menuCategories[0].id);
const scrollIntoView = ref("");
const sectionOffsets = ref<Array<{ id: string; top: number }>>([]);
const scrollMetrics = ref({ viewportHeight: 0, contentHeight: 0 });
const isCategoryJumping = ref(false);
const instance = getCurrentInstance();
let initialMeasureTimer: ReturnType<typeof setTimeout> | undefined;
let categoryJumpTimer: ReturnType<typeof setTimeout> | undefined;

const productsByCategory = computed(() => {
  return products.reduce<Record<string, typeof products>>((groups, product) => {
    groups[product.categoryId] = groups[product.categoryId] || [];
    groups[product.categoryId].push(product);
    return groups;
  }, {});
});

const menuSections = computed(() => {
  return menuCategories
    .map((category) => ({
      category,
      products: productsByCategory.value[category.id] || [],
    }))
    .filter((section) => section.products.length > 0);
});

onMounted(() => {
  nextTick(() => {
    measureSectionOffsets();
    initialMeasureTimer = setTimeout(measureSectionOffsets, 300);
  });
});

onUnmounted(() => {
  if (initialMeasureTimer) {
    clearTimeout(initialMeasureTimer);
  }
  if (categoryJumpTimer) {
    clearTimeout(categoryJumpTimer);
  }
});

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

  if (categoryJumpTimer) {
    clearTimeout(categoryJumpTimer);
  }
  categoryJumpTimer = setTimeout(() => {
    isCategoryJumping.value = false;
  }, 700);
}

function handleProductScroll(event: { detail: { scrollTop: number } }) {
  if (isCategoryJumping.value) {
    return;
  }

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

    if (!listRect || !sectionRects.length) {
      return;
    }

    sectionOffsets.value = sectionRects
      .filter((rect) => typeof rect.id === "string" && typeof rect.top === "number")
      .map((rect) => ({
        id: String(rect.id).replace(/^category-/, ""),
        top: Math.max(0, Number(rect.top) - Number(listRect.top)),
      }));
    scrollMetrics.value = {
      viewportHeight: Number(listRect.height || 0),
      contentHeight: sectionRects.reduce((height, rect) => {
        if (typeof rect.bottom !== "number") {
          return height;
        }
        return Math.max(height, Number(rect.bottom) - Number(listRect.top));
      }, 0),
    };
  });
}

function goHome() {
  uni.redirectTo({ url: "/pages/home/home" });
}

function goSpec(_productId: string) {
  uni.navigateTo({ url: "/pages/spec/spec" });
}

function goCheckout() {
  uni.navigateTo({ url: "/pages/checkout/checkout" });
}
</script>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  height: 100vh;
  padding-bottom: 180rpx;
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
  padding: 0 24rpx 24rpx 32rpx;
  overflow: hidden;
  background: #ffffff;
}

.product-list :deep(.uni-scroll-view) {
  height: 100%;
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
