<template>
  <view class="tabbar">
    <view
      v-for="tab in tabs"
      :key="tab.key"
      class="tab-item"
      :class="{ active: tab.key === active }"
      @tap="$emit('change', tab.key)"
    >
      <SkeletonBox class="tab-icon" radius="sm" :shimmer="false" />
      <text>{{ tab.label }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import SkeletonBox from "./SkeletonBox.vue";

type AppTabKey = "home" | "menu" | "orders" | "profile";

defineProps<{
  active: AppTabKey;
}>();

defineEmits<{
  (event: "change", key: AppTabKey): void;
}>();

const tabs: Array<{ key: AppTabKey; label: string }> = [
  { key: "home", label: "首页" },
  { key: "menu", label: "点单" },
  { key: "orders", label: "订单" },
  { key: "profile", label: "我的" },
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
  border-radius: 10rpx;
  background: currentColor;
}
</style>
