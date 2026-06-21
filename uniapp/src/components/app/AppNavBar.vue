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
  min-height: 116rpx;
  padding: 32rpx 24rpx 12rpx;
}

.nav-left {
  position: absolute;
  left: 24rpx;
  bottom: 16rpx;
  display: flex;
  align-items: center;
  gap: 22rpx;
}

.back {
  font-size: 64rpx;
  font-weight: 300;
  line-height: 1;
}

.search {
  font-size: 48rpx;
  line-height: 1;
}

.title {
  width: 100%;
  text-align: center;
  color: var(--ld-mini-text);
  font-size: 36rpx;
  font-weight: 700;
}

</style>
