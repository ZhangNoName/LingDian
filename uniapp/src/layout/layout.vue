<template>
  <view class="layout">
    <view class="content">
      <slot />
    </view>
    <AppTabBar v-if="showTabBar" :active="active" @change="handleTabChange" />
  </view>
</template>

<script setup lang="ts">
import AppTabBar from "@/components/app/AppTabBar.vue";
import { isProtectedCustomerRoute, requireCustomerAuth } from "@/services/auth-navigation";

type AppTabKey = "home" | "menu" | "orders" | "profile";

const props = withDefaults(
  defineProps<{
    active?: AppTabKey;
    showTabBar?: boolean;
  }>(),
  {
    active: "home",
    showTabBar: true,
  },
);

const routes: Record<AppTabKey, string> = {
  home: "/pages/home/home",
  menu: "/pages/order/order",
  orders: "/pages/his/his",
  profile: "/pages/user/user",
};

async function handleTabChange(key: AppTabKey) {
  if (key === props.active) return;
  const target = routes[key];
  if (isProtectedCustomerRoute(target) && !(await requireCustomerAuth(target))) return;
  uni.redirectTo({ url: target });
}
</script>

<style scoped>
.layout {
  display: flex;
  height: 100vh;
  flex-direction: column;
  overflow: hidden;
  background: var(--ld-mini-bg);
}

.content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-top: var(--status-bar-height, 0px);
}
</style>
