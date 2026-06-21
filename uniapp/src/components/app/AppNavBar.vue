<template>
  <view class="nav">
    <view class="nav-left">
      <text v-if="showBack" class="back" @tap="$emit('back')">‹</text>
      <text v-if="showSearch" class="search">⌕</text>
      <slot name="left" />
    </view>
    <text v-if="title" class="title">{{ title }}</text>
  </view>
</template>

<script setup lang="ts">
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
  min-height: var(--ld-nav-height, 96rpx);
  padding: 24rpx var(--ld-page-padding, 24rpx) 8rpx;
}

.nav-left {
  position: absolute;
  left: var(--ld-page-padding, 24rpx);
  bottom: 14rpx;
  display: flex;
  align-items: center;
  gap: 18rpx;
}

.back {
  font-size: 48rpx;
  font-weight: 300;
  line-height: 1;
}

.search {
  font-size: 38rpx;
  line-height: 1;
}

.title {
  width: 100%;
  text-align: center;
  color: var(--ld-mini-text);
  font-size: var(--ld-font-title, 32rpx);
  font-weight: 700;
}
</style>
