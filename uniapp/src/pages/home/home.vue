<template>
  <Layout active="home">
    <scroll-view class="page" scroll-y>
      <view class="home-header">
        <HomeHero />
        <MemberStrip :presentation="customerPresentation" @login="goLogin" />
      </view>
      <view class="content">
        <ServiceModeCards v-if="availableServiceModes.length" :modes="availableServiceModes" @select="goMenu" />
        <RecommendSection v-if="menu" :products="featuredProducts" @browse="goMenu" @select="goSpec" />
        <view v-else-if="menuError" class="menu-state">
          <text>{{ menuError }}</text>
          <AppActionButton variant="outline" size="small" @activate="loadMenu">重试</AppActionButton>
        </view>
        <text v-else>正在加载菜单…</text>
      </view>
    </scroll-view>
  </Layout>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { onLoad, onShow } from "@dcloudio/uni-app";
import type { AuthenticatedUser } from "@lingdian/contracts";
import Layout from "@/layout/layout.vue";
import AppActionButton from "@/components/app/AppActionButton.vue";
import HomeHero from "@/components/home/HomeHero.vue";
import MemberStrip from "@/components/home/MemberStrip.vue";
import RecommendSection from "@/components/home/RecommendSection.vue";
import ServiceModeCards from "@/components/app/ServiceModeCards.vue";
import { homeServiceModes } from "@/data/home-service-modes";
import { customerAuth } from "@/services/auth";
import { fetchMenu, type MenuViewModel } from "@/services/catalog";
import { buildCustomerPresentation } from "@/services/customer-presentation";
import { buildServiceModeUrl } from "@/services/service-mode";
import type { ServiceMode } from "@/types/store";

const menu = ref<MenuViewModel | null>(null);
const menuError = ref("");
const currentUser = ref<AuthenticatedUser | undefined>(customerAuth.getUser());

const featuredProducts = computed(() => {
  return (menu.value?.products ?? []).filter((product) => product.tags.includes("推荐")).slice(0, 6);
});
const availableServiceModes = computed(() => {
  const supportedModes = menu.value?.store.supportModes;
  return supportedModes
    ? homeServiceModes.filter((mode) => supportedModes.includes(mode.key))
    : [];
});
const customerPresentation = computed(() => buildCustomerPresentation(currentUser.value));

onLoad(() => { void loadMenu(); });

async function loadMenu() {
  menuError.value = "";
  try {
    menu.value = await fetchMenu();
  } catch (error) {
    menuError.value = error instanceof Error ? error.message : "菜单加载失败";
  }
}

onShow(async () => {
  if (!customerAuth.isSignedIn()) await customerAuth.refresh();
  currentUser.value = customerAuth.getUser();
});

function selectedOrDefaultMode(mode?: ServiceMode): ServiceMode {
  return mode ?? availableServiceModes.value[0]?.key ?? "takeaway";
}

function goMenu(mode?: ServiceMode) {
  uni.redirectTo({ url: buildServiceModeUrl("/pages/order/order", selectedOrDefaultMode(mode)) });
}

function goSpec(productId: string) {
  uni.navigateTo({
    url: buildServiceModeUrl("/pages/spec/spec", selectedOrDefaultMode(), { id: productId }),
  });
}

function goLogin() {
  uni.navigateTo({ url: "/pages/auth/login?redirect=%2Fpages%2Fhome%2Fhome" });
}
</script>

<style scoped>
.page {
  box-sizing: border-box;
  height: 100%;
  background: var(--ld-mini-bg);
  padding: 16rpx var(--ld-page-padding, 24rpx) calc(var(--ld-tabbar-height, 104rpx) + var(--ld-page-bottom-safe, 24rpx));
}

.home-header {
  display: grid;
  gap: var(--ld-card-gap, 20rpx);
}

.menu-state {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.content {
  display: grid;
  gap: var(--ld-card-gap, 20rpx);
  margin-top: var(--ld-card-gap, 20rpx);
}
</style>
