<template>
  <view class="mode-grid">
    <view v-for="mode in modes" :key="mode.key" class="mode-card" @tap="$emit('select', mode.key)">
      <text class="mode-title">{{ mode.title }}</text>
      <text class="mode-subtitle">{{ mode.subtitle }}</text>
      <SkeletonBox class="mode-visual" radius="md" />
    </view>
  </view>
</template>

<script setup lang="ts">
import SkeletonBox from "@/components/app/SkeletonBox.vue";
import type { HomeServiceMode, ServiceMode } from "@/types/store";

defineProps<{
  modes: HomeServiceMode[];
}>();

defineEmits<{
  (event: "select", key: ServiceMode): void;
}>();
</script>

<style scoped>
.mode-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24rpx;
}

.mode-card {
  min-height: 236rpx;
  padding: 32rpx 24rpx 20rpx;
  border-radius: 28rpx;
  background: #ffffff;
  text-align: center;
  box-shadow: var(--ld-mini-shadow-card);
}

.mode-title {
  display: block;
  color: var(--ld-mini-text);
  font-size: 42rpx;
  font-weight: 900;
}

.mode-subtitle {
  display: block;
  margin-top: 6rpx;
  color: #c08f3c;
  font-size: 22rpx;
}

.mode-visual {
  width: 156rpx;
  height: 100rpx;
  margin: 18rpx auto 0;
}
</style>
