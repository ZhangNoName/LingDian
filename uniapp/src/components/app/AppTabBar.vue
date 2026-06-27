<template>
  <view class="tabbar">
    <view
      v-for="tab in tabs"
      :key="tab.key"
      class="tab-item"
      :class="{ active: tab.key === active }"
      @tap="$emit('change', tab.key)"
    >
      <component :is="tab.icon" class="tab-icon" :stroke-width="2.4" />
      <text>{{ tab.label }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { tabIcons, type AppTabKey } from "@lingdian/icons/miniapp";

defineProps<{
  active: AppTabKey;
}>();

defineEmits<{
  (event: "change", key: AppTabKey): void;
}>();

const tabs: Array<{ key: AppTabKey; label: string; icon: (typeof tabIcons)[AppTabKey] }> = [
  { key: "home", label: "首页", icon: tabIcons.home },
  { key: "menu", label: "点单", icon: tabIcons.menu },
  { key: "orders", label: "订单", icon: tabIcons.orders },
  { key: "profile", label: "我的", icon: tabIcons.profile },
];
</script>

<style scoped>
.tabbar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 20;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  height: var(--ld-tabbar-height, 104rpx);
  padding: 14rpx var(--ld-page-padding, 24rpx) 0;
  border-top: 1rpx solid var(--ld-mini-border);
  background: #ffffff;
  padding-bottom: env(safe-area-inset-bottom);
}

.tab-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
  color: #b9b9b9;
  font-size: var(--ld-font-xs, 22rpx);
}

.tab-item.active {
  color: var(--ld-mini-primary);
  font-weight: 700;
}

.tab-icon {
  width: 30rpx;
  height: 30rpx;
  color: currentColor;
}
</style>
