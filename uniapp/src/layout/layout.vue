<template>
  <view class="layout">
    <view class="content">
      <slot />
    </view>
    <AppTabBar :active="active" @change="handleTabChange" />
  </view>
</template>

<script setup lang="ts">
import AppTabBar from "@/components/app/AppTabBar.vue";

type AppTabKey = "home" | "menu" | "orders" | "profile";

const props = defineProps<{
  active: AppTabKey;
}>();

const routes: Record<AppTabKey, string> = {
  home: "/pages/home/home",
  menu: "/pages/order/order",
  orders: "/pages/his/his",
  profile: "/pages/user/user",
};

function handleTabChange(key: AppTabKey) {
  if (key === props.active) return;
  uni.redirectTo({ url: routes[key] });
}
</script>

<style scoped>
.layout {
  min-height: 100vh;
  padding-bottom: 120rpx;
  background: var(--ld-mini-bg);
}

.content {
  min-height: calc(100vh - 120rpx);
}
</style>
