<template>
  <view class="layout">
    <view class="content">
      <slot />
    </view>
    <view class="tabbar">
      <view
        v-for="tab in tabs"
        :key="tab.key"
        class="tab-item"
        :class="{ active: tab.key === activeTab }"
      >
        <text class="tab-label">{{ tab.label }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
defineProps<{ activeTab: string }>();

const tabs = [
  { key: "home", label: "首页" },
  { key: "order", label: "点餐" },
  { key: "his", label: "订单" },
  { key: "user", label: "我的" },
];
</script>

<style scoped>
.layout {
  min-height: 100vh;
  padding-bottom: 128rpx;
  background: var(--ld-bg-page);
}

.content {
  min-height: calc(100vh - 128rpx);
}

.tabbar {
  position: fixed;
  left: 24rpx;
  right: 24rpx;
  bottom: 24rpx;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12rpx;
  padding: 14rpx;
  border-radius: 999rpx;
  border: 1rpx solid var(--ld-border-default);
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 18rpx 40rpx rgba(123, 63, 38, 0.14);
}

.tab-item {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 72rpx;
  border-radius: 999rpx;
}

.tab-item.active {
  background: var(--ld-accent-bg);
}

.tab-label {
  font-size: 24rpx;
  color: var(--ld-text-muted);
}

.tab-item.active .tab-label {
  color: var(--ld-color-primary);
  font-weight: 600;
}
</style>
