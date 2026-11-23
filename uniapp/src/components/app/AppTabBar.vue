<template>
  <view class="tabbar" role="tablist" aria-label="主导航">
    <view
      v-for="tab in tabs"
      :key="tab.key"
      class="tab-item"
      :class="{ active: tab.key === active }"
      role="tab"
      tabindex="0"
      :aria-label="tab.label"
      :aria-selected="tab.key === active"
      @keydown.enter="$emit('change', tab.key)"
      @keydown.space.prevent="$emit('change', tab.key)"
      @tap="$emit('change', tab.key)"
    >
      <AppIcon :name="tab.key" :size="42" :tone="tab.key === active ? 'primary' : 'muted'" />
      <text>{{ tab.label }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import AppIcon from "@/components/app/AppIcon.vue";
import type { AppTabKey } from "@lingdian/icons/miniapp";

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
  z-index: 20;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  flex: 0 0 auto;
  min-height: var(--ld-tabbar-height, 104rpx);
  padding: 14rpx var(--ld-page-padding, 24rpx) 0;
  border-top: 1rpx solid var(--ld-mini-border);
  background: #ffffff;
  padding-bottom: env(safe-area-inset-bottom);
}

.tab-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: var(--ld-tab-touch-height, 80rpx);
  gap: 8rpx;
  color: #666666;
  font-size: var(--ld-font-xs, 22rpx);
}

.tab-item.active {
  color: var(--ld-mini-primary);
  font-weight: 700;
}

</style>
