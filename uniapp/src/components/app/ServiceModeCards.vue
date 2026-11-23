<template>
  <view class="mode-grid" :class="{ compact: selected }">
    <view
      v-for="mode in modes"
      :key="mode.key"
      class="mode-card"
      role="button"
      tabindex="0"
      :class="['mode-' + mode.key, { selected: selected === mode.key }]"
      :aria-pressed="selected ? selected === mode.key : undefined"
      :aria-label="mode.title"
      @keydown.enter="$emit('select', mode.key)"
      @keydown.space.prevent="$emit('select', mode.key)"
      @tap="$emit('select', mode.key)"
    >
      <view class="mode-icon-shell">
        <AppIcon :name="mode.key" :tone="mode.key === 'takeaway' ? 'primary' : 'text'" />
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
  --mode-bg: var(--ld-mini-warning-bg);
  --mode-ink: var(--ld-mini-warning-text);
  display: grid;
  flex: 1 1 160rpx;
  gap: 8rpx;
  justify-items: center;
  align-content: center;
  min-height: 108rpx;
  padding: 12rpx 8rpx;
  border: 2rpx solid transparent;
  border-radius: var(--ld-radius-8);
  background: var(--mode-bg);
  color: var(--mode-ink);
  text-align: center;
}
.mode-takeaway {
  --mode-bg: var(--ld-mini-primary-soft);
  --mode-ink: var(--ld-mini-primary-pressed);
}
.mode-delivery {
  --mode-bg: var(--ld-mini-info-bg);
  --mode-ink: var(--ld-mini-info-text);
}
.compact .mode-card {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 76rpx;
  background: var(--ld-mini-surface);
  border-color: var(--ld-mini-border);
}
.compact .mode-card.selected {
  background: var(--mode-bg);
  border-color: var(--mode-ink);
}
.mode-icon-shell { display: flex; }
.mode-title { font-size: var(--ld-font-base); font-weight: 750; }
</style>
