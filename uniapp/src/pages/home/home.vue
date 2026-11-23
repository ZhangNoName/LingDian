<template>
  <Layout active="home">
    <view class="page">
      <view class="home-header">
        <HomeHero />
      </view>
      <view class="content">
        <ServiceModeCards v-if="availableServiceModes.length" :modes="availableServiceModes" @select="goMenu" />
        <MemberStrip :presentation="customerPresentation" @login="goLogin" />
        <RecommendSection v-if="menu" :products="featuredProducts" @browse="goMenu" @select="goSpec" />
        <view v-else-if="menuError" class="menu-state">
          <text>{{ menuError }}</text>
          <AppActionButton variant="outline" size="small" @activate="loadMenu">重试</AppActionButton>
        </view>
        <text v-else>正在加载菜单…</text>
      </view>
    </view>
  </Layout>
</template>

<script setup lang="ts">
import { computed, ref, shallowRef } from "vue";
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
import { fetchMenu, peekMenu } from "@/services/catalog";
import { currentCustomerPage, openCustomerLogin } from "@/services/customer-login";
import { buildCustomerPresentation } from "@/services/customer-presentation";
import { profile } from "@/services/profile";
import { buildServiceModeUrl } from "@/services/service-mode";
import type { ServiceMode } from "@/types/store";

const menu = shallowRef(peekMenu());
const menuError = ref("");
const currentUser = ref<AuthenticatedUser | undefined>(customerAuth.getUser());
const nickname = ref<string | null>(null);
let profileRequest = 0;

const featuredProducts = computed(() => {
  return (menu.value?.products ?? []).filter((product) => product.tags.includes("推荐")).slice(0, 6);
});
const availableServiceModes = computed(() => {
  const supportedModes = menu.value?.store.supportModes;
  return supportedModes
    ? homeServiceModes.filter((mode) => supportedModes.includes(mode.key))
    : [];
});
const customerPresentation = computed(() => buildCustomerPresentation(currentUser.value, { nickname: nickname.value }));

onLoad(() => { void loadMenu(); });

async function loadMenu() {
  menuError.value = "";
  try {
    menu.value = await fetchMenu();
  } catch (error) {
    menuError.value = error instanceof Error ? error.message : "菜单加载失败";
  }
}

onShow(() => { void loadMember(); });

async function loadMember() {
  const call = ++profileRequest;
  if (!customerAuth.isSignedIn()) await customerAuth.refresh();
  if (call !== profileRequest) return;
  const user = customerAuth.getUser();
  if (user?.userId !== currentUser.value?.userId) nickname.value = null;
  currentUser.value = user;
  if (!user) return;
  const result = await profile.getNickname().catch(() => null);
  if (result && call === profileRequest && customerAuth.getUser()?.userId === user.userId) {
    nickname.value = result.nickname;
  }
}

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

async function goLogin() {
  if (customerAuth.isSignedIn() || await openCustomerLogin(currentCustomerPage())) await loadMember();
}
</script>

<style scoped>
.page {
  box-sizing: border-box;
  min-height: 100%;
  background: var(--ld-mini-bg);
  padding: 16rpx var(--ld-page-padding, 24rpx) 24rpx;
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
