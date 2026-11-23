<template>
  <view class="nav">
    <view class="nav-left">
      <view v-if="showBack" class="icon-button" role="button" tabindex="0" aria-label="返回" @keydown.enter="$emit('back')" @keydown.space.prevent="$emit('back')" @tap="$emit('back')">
        <AppIcon name="back" :size="40" />
      </view>
      <slot name="left" />
    </view>
    <text v-if="title" class="title">{{ title }}</text>
  </view>
</template>

<script setup lang="ts">
import AppIcon from "@/components/app/AppIcon.vue";

withDefaults(
  defineProps<{
    title?: string;
    showBack?: boolean;
  }>(),
  {
    title: "",
    showBack: false,
  },
);

defineEmits<{
  (event: "back"): void;
}>();
</script>

<style scoped>
.nav {
  position: relative;
  display: flex;
  align-items: center;
  min-height: var(--ld-nav-safe-height, 112rpx);
  padding: 12rpx var(--ld-page-padding, 24rpx);
  background: var(--ld-mini-surface);
}

.nav-left {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  min-width: 88rpx;
  gap: 12rpx;
}

.icon-button {
  display: grid;
  place-items: center;
  width: 88rpx;
  height: 88rpx;
  min-width: 44px;
  min-height: 44px;
  border-radius: 50%;
  color: var(--ld-mini-text);
  cursor: pointer;
}

.icon-button:active {
  background: var(--ld-mini-bg);
}

.title {
  position: absolute;
  left: 0;
  right: 0;
  width: 100%;
  padding: 0 112rpx;
  overflow: hidden;
  text-align: center;
  color: var(--ld-mini-text);
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--ld-font-title, 32rpx);
  font-weight: 700;
}
</style>
