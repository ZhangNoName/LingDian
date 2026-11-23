<template>
  <view class="tabs" role="tablist" aria-label="订单分类">
    <view
      class="tab"
      :class="{ active: active === 'current' }"
      role="tab"
      tabindex="0"
      :aria-selected="active === 'current'"
      @keydown.enter="$emit('change', 'current')"
      @keydown.space.prevent="$emit('change', 'current')"
      @tap="$emit('change', 'current')"
    >当前订单</view>
    <view
      class="tab"
      :class="{ active: active === 'history' }"
      role="tab"
      tabindex="0"
      :aria-selected="active === 'history'"
      @keydown.enter="$emit('change', 'history')"
      @keydown.space.prevent="$emit('change', 'history')"
      @tap="$emit('change', 'history')"
    >历史订单</view>
  </view>
</template>

<script setup lang="ts">
defineProps<{
  active: "current" | "history";
}>();

defineEmits<{
  (event: "change", tab: "current" | "history"): void;
}>();
</script>

<style scoped>
.tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  margin: 0 var(--ld-page-padding);
  padding: 6rpx;
  gap: 6rpx;
  border-radius: var(--ld-radius-8);
  background: var(--ld-mini-neutral-bg);
  color: var(--ld-mini-neutral-text);
  text-align: center;
  font-size: var(--ld-font-title, 32rpx);
  font-weight: 900;
}

.tab {
  position: relative;
  line-height: var(--ld-tabs-height, 72rpx);
}

.tab.active {
  border-radius: var(--ld-radius-8);
  background: var(--ld-mini-surface);
  color: var(--ld-mini-primary-pressed);
}
</style>
