<template>
  <view class="nav">
    <view class="nav-left">
      <view v-if="showBack" class="icon-button" role="button" tabindex="0" aria-label="返回" @keydown.enter="$emit('back')" @keydown.space.prevent="$emit('back')" @tap="$emit('back')">
        <BackIcon class="back-icon" aria-hidden="true" />
      </view>
      <view v-if="showSearch" class="icon-button">
        <SearchIcon class="icon" />
      </view>
      <slot name="left" />
    </view>
    <text v-if="title" class="title">{{ title }}</text>
  </view>
</template>

<script setup lang="ts">
import { BackIcon, SearchIcon } from "@lingdian/icons/miniapp";

withDefaults(
  defineProps<{
    title?: string;
    showBack?: boolean;
    showSearch?: boolean;
  }>(),
  {
    title: "",
    showBack: false,
    showSearch: false,
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
  left: var(--ld-page-padding, 24rpx);
  display: flex;
  align-items: center;
  min-width: 88rpx;
  gap: 12rpx;
}

.icon-button {
  display: grid;
  place-items: center;
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  color: var(--ld-mini-text);
}

.back-icon {
  display: block;
  width: 48rpx;
  height: 48rpx;
  color: #1f2937;
}

.icon {
  display: block;
  width: 36rpx;
  height: 36rpx;
  font-size: 36rpx;
  line-height: 36rpx;
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
