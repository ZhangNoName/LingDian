<template>
  <view class="tabs">
    <view class="tab" :class="{ active: active === 'current' }" @tap="$emit('change', 'current')">当前订单</view>
    <view class="tab" :class="{ active: active === 'history' }" @tap="$emit('change', 'history')">历史订单</view>
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
  height: var(--ld-tabs-height, 72rpx);
  background: #ffffff;
  color: #5f5f5f;
  text-align: center;
  font-size: var(--ld-font-title, 32rpx);
  font-weight: 900;
}

.tab {
  position: relative;
  line-height: var(--ld-tabs-height, 72rpx);
}

.tab.active {
  color: var(--ld-mini-primary, #ed1c24);
}

.tab.active::after {
  position: absolute;
  left: 50%;
  bottom: 0;
  width: 64rpx;
  height: 5rpx;
  border-radius: 999rpx;
  background: var(--ld-mini-primary);
  content: "";
  transform: translateX(-50%);
}
</style>
