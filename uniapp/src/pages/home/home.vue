<template>
  <Layout active="home">
    <view class="page">
      <MemberStrip :member="member" />
      <view class="content">
        <ServiceModeCards :modes="homeServiceModes" @select="goMenu" />
        <RecommendSection :products="featuredProducts" @select="goSpec" />
      </view>
    </view>
  </Layout>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import Layout from "@/layout/layout.vue";
import MemberStrip from "@/components/home/MemberStrip.vue";
import RecommendSection from "@/components/home/RecommendSection.vue";
import ServiceModeCards from "@/components/home/ServiceModeCards.vue";
import { homeServiceModes, member } from "@/data/mock";
import { fetchMenu, type MenuViewModel } from "@/services/catalog";
import type { ServiceMode } from "@/types/store";

const menu = ref<MenuViewModel | null>(null);

const featuredProducts = computed(() => {
  return (menu.value?.products ?? []).filter((product) => product.tags.includes("推荐")).slice(0, 6);
});

onLoad(async () => {
  try {
    menu.value = await fetchMenu();
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : "菜单加载失败", icon: "none" });
  }
});

function goMenu(_mode: ServiceMode) {
  uni.redirectTo({ url: "/pages/order/order" });
}

function goSpec(productId: string) {
  uni.navigateTo({ url: `/pages/spec/spec?id=${productId}` });
}
</script>

<style scoped>
.page {
  min-height: 100%;
  background: var(--ld-mini-bg);
  padding: 16rpx var(--ld-page-padding, 24rpx) var(--ld-page-bottom-safe, 24rpx);
  padding-top: calc(env(safe-area-inset-top) + 16rpx);
}

.content {
  display: grid;
  gap: var(--ld-card-gap, 20rpx);
  margin-top: var(--ld-card-gap, 20rpx);
}
</style>

