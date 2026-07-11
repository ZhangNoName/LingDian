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

function handleTabChange(key: AppTabKey) {
  if (key === props.active) return;
  uni.redirectTo({ url: routes[key] });
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
  padding-top: env(safe-area-inset-top);
}
</style>
