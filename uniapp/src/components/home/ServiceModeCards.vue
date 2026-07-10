<template>
  <view class="mode-grid">
    <view v-for="mode in modes" :key="mode.key" class="mode-card" @tap="$emit('select', mode.key)">
      <view class="mode-icon-shell">
        <HomeDineInIcon v-if="mode.key === 'dineIn'" class="mode-icon" :stroke-width="2.2" />
        <HomeDeliveryIcon v-else-if="mode.key === 'delivery'" class="mode-icon" :stroke-width="2.2" />
        <HomeTakeawayIcon v-else class="mode-icon" :stroke-width="2.2" />
      </view>
      <text class="mode-title">{{ mode.title }}</text>
      <text class="mode-subtitle">{{ mode.subtitle }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { HomeDeliveryIcon, HomeDineInIcon, HomeTakeawayIcon } from "@lingdian/icons/miniapp";
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
  gap: var(--ld-card-gap, 20rpx);
}

.mode-card {
  min-height: 176rpx;
  padding: 24rpx var(--ld-card-padding, 24rpx);
  border-radius: var(--ld-radius-16, 16px);
  background: #ffffff;
  text-align: center;
  box-shadow: var(--ld-mini-shadow-float);
}

.mode-icon-shell {
  display: grid;
  place-items: center;
  width: 64rpx;
  height: 64rpx;
  margin: 0 auto 12rpx;
  border-radius: 50%;
  background: var(--ld-mini-primary-soft);
  color: var(--ld-mini-primary);
}

.mode-icon {
  width: 36rpx;
  height: 36rpx;
}

.mode-title {
  display: block;
  color: var(--ld-mini-text);
  font-size: var(--ld-font-title-lg, 36rpx);
  font-weight: 900;
}

.mode-subtitle {
  display: block;
  margin-top: 6rpx;
  color: #c08f3c;
  font-size: var(--ld-font-xs, 22rpx);
}

</style>
