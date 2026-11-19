<template>
  <view class="mode-grid">
    <view
      v-for="mode in modes"
      :key="mode.key"
      class="mode-card"
      role="button"
      tabindex="0"
      :class="{ selected: selected === mode.key }"
      :aria-pressed="selected ? selected === mode.key : undefined"
      :aria-label="mode.title"
      @keydown.enter="$emit('select', mode.key)"
      @keydown.space.prevent="$emit('select', mode.key)"
      @tap="$emit('select', mode.key)"
    >
      <view class="mode-icon-shell">
        <AppIcon :name="mode.key" tone="primary" />
      </view>
      <text class="mode-title">{{ mode.title }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import AppIcon from "@/components/app/AppIcon.vue";
import type { HomeServiceMode, ServiceMode } from "@/types/store";

defineProps<{
  modes: readonly HomeServiceMode[];
  selected?: ServiceMode;
}>();

defineEmits<{
  (event: "select", key: ServiceMode): void;
}>();
</script>

<style scoped>
.mode-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}
.mode-card {
  display: flex;
  flex: 1 1 160rpx;
  gap: 10rpx;
  align-items: center;
  justify-content: center;
  padding: 22rpx 10rpx;
  border: 1rpx solid var(--ld-mini-border);
  border-radius: var(--ld-radius-8);
  background: var(--ld-mini-surface);
  color: var(--ld-mini-text);
}
.mode-card.selected { border-color: var(--ld-mini-primary); background: var(--ld-mini-primary-soft); }
.mode-icon-shell { display: flex; color: var(--ld-mini-primary); }
.mode-title { font-size: var(--ld-font-base); font-weight: 600; }
</style>
