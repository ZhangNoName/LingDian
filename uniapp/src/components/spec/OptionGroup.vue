<template>
  <view class="group">
    <view class="title-row">
      <text class="title">{{ group.name }}</text>
      <text v-if="group.required" class="required">必选</text>
    </view>
    <view class="grid">
      <button
        v-for="option in group.options"
        :key="option.id"
        class="card"
        :class="{ active: selectedIds.includes(option.id) }"
        :aria-pressed="selectedIds.includes(option.id)"
        @tap="$emit('select', group.id, option.id)"
        @keydown.enter="$emit('select', group.id, option.id)"
        @keydown.space.prevent="$emit('select', group.id, option.id)"
      >
        <image v-if="option.imageUrl" class="image" :src="option.imageUrl" mode="aspectFit" />
        <text class="name">{{ option.name }}</text>
        <text v-if="option.priceDelta" class="price-delta">{{ option.priceDelta > 0 ? "+" : "−" }}¥{{ formatAmount(Math.abs(option.priceDelta)) }}</text>
      </button>
    </view>
  </view>
</template>

<script setup lang="ts">
import type { OptionGroup } from "@/types/menu";
import { formatAmount } from "@/utils/money";

defineProps<{
  group: OptionGroup;
  selectedIds: string[];
}>();

defineEmits<{
  (event: "select", groupId: string, optionId: string): void;
}>();
</script>

<style scoped>
.group {
  padding: 0 var(--ld-page-padding, 24rpx) 24rpx;
}

.title-row {
  display: flex;
  align-items: center;
  gap: 10rpx;
  margin-bottom: 18rpx;
}

.title {
  color: var(--ld-mini-text);
  font-size: var(--ld-font-md);
  font-weight: 750;
}

.required {
  flex: none;
  padding: 3rpx 10rpx;
  border-radius: 8rpx;
  background: var(--ld-mini-warning-bg);
  color: var(--ld-mini-warning-text);
  font-size: var(--ld-font-xs);
}

.grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12rpx;
}

.card {
  display: grid;
  align-content: center;
  justify-items: center;
  gap: 6rpx;
  width: 100%;
  min-height: 44px;
  margin: 0;
  padding: 12rpx;
  border: 1rpx solid var(--ld-mini-border);
  border-radius: var(--ld-radius-8);
  background: var(--ld-mini-surface);
  color: var(--ld-mini-text);
  text-align: center;
  line-height: 1.35;
}

.card::after { border: 0; }

.card.active {
  border-color: var(--ld-mini-primary);
  background: var(--ld-mini-primary-soft);
  color: var(--ld-mini-primary-pressed);
}

.image {
  width: 100%;
  height: 88rpx;
  border-radius: var(--ld-radius-8, 8px);
}

.name {
  font-size: var(--ld-font-sm, 24rpx);
  overflow-wrap: anywhere;
}

.price-delta {
  font-size: var(--ld-font-xs);
}
</style>
