<template>
  <Layout active="home">
    <view class="page">
      <MemberStrip :presentation="customerPresentation" @login="goLogin" />
      <view class="content">
        <ServiceModeCards :modes="homeServiceModes" @select="goMenu" />
        <RecommendSection :products="featuredProducts" @browse="goMenu" @select="goSpec" />
      </view>
    </view>
  </Layout>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { onLoad, onShow } from "@dcloudio/uni-app";
import type { AuthenticatedUser } from "@lingdian/contracts";
import Layout from "@/layout/layout.vue";
import MemberStrip from "@/components/home/MemberStrip.vue";
import RecommendSection from "@/components/home/RecommendSection.vue";
import ServiceModeCards from "@/components/home/ServiceModeCards.vue";
import { homeServiceModes } from "@/data/mock";
import { customerAuth } from "@/services/auth";
import { fetchMenu, type MenuViewModel } from "@/services/catalog";
import { buildCustomerPresentation } from "@/services/customer-presentation";
import type { ServiceMode } from "@/types/store";

const menu = ref<MenuViewModel | null>(null);
const currentUser = ref<AuthenticatedUser | undefined>(customerAuth.getUser());

const featuredProducts = computed(() => {
  return (menu.value?.products ?? []).filter((product) => product.tags.includes("推荐")).slice(0, 6);
});
const customerPresentation = computed(() => buildCustomerPresentation(currentUser.value));

onLoad(async () => {
  try {
    menu.value = await fetchMenu();
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : "菜单加载失败", icon: "none" });
  }
});

onShow(async () => {
  if (!customerAuth.isSignedIn()) await customerAuth.refresh();
  currentUser.value = customerAuth.getUser();
});

function goMenu(_mode?: ServiceMode) {
  uni.redirectTo({ url: "/pages/order/order" });
}

function goSpec(productId: string) {
  uni.navigateTo({ url: `/pages/spec/spec?id=${productId}` });
}

function goLogin() {
  uni.navigateTo({ url: "/pages/auth/login?redirect=%2Fpages%2Fhome%2Fhome" });
}
</script>

<style scoped>
.page {
  min-height: 100%;
  background: var(--ld-mini-bg);
  padding: 16rpx var(--ld-page-padding, 24rpx) var(--ld-page-bottom-safe, 24rpx);
}

.content {
  display: grid;
  gap: var(--ld-card-gap, 20rpx);
  margin-top: var(--ld-card-gap, 20rpx);
}
</style>
