<template>
  <view class="group">
    <text class="title">{{ group.name }}</text>
    <view class="grid">
      <view
        v-for="option in group.options"
        :key="option.id"
        class="card"
        :class="{ active: selectedId === option.id }"
        @tap="$emit('select', group.id, option.id)"
      >
        <image v-if="option.imageUrl" class="image" :src="option.imageUrl" mode="aspectFill" />
        <SkeletonBox v-else class="image" radius="md" />
        <text class="name">{{ option.name }}</text>
        <view class="radio"><text v-if="selectedId === option.id">✓</text></view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import SkeletonBox from "@/components/app/SkeletonBox.vue";
import type { OptionGroup } from "@/types/menu";

defineProps<{
  group: OptionGroup;
  selectedId?: string;
}>();

defineEmits<{
  (event: "select", groupId: string, optionId: string): void;
}>();
</script>

<style scoped>
.group {
  padding: 0 var(--ld-page-padding, 24rpx);
}

.title {
  display: block;
  margin-bottom: 18rpx;
  color: #777777;
  font-size: var(--ld-font-base, 26rpx);
}

.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--ld-card-gap, 20rpx);
}

.card {
  position: relative;
  min-height: 232rpx;
  padding: 16rpx 12rpx 52rpx;
  border: 1rpx solid #eeeeee;
  border-radius: 14rpx;
  background: #ffffff;
  text-align: center;
}

.card.active {
  border-color: #b9934b;
}

.image {
  width: 128rpx;
  height: 88rpx;
  margin: 0 auto 14rpx;
  border-radius: var(--ld-radius-8, 8px);
}

.name {
  color: var(--ld-mini-text);
  font-size: var(--ld-font-sm, 24rpx);
  line-height: 1.35;
}

.radio {
  position: absolute;
  right: 20rpx;
  bottom: 20rpx;
  width: 40rpx;
  height: 40rpx;
  border: 4rpx solid #e3e3e3;
  border-radius: 50%;
  color: #ffffff;
  font-size: var(--ld-font-base, 26rpx);
  font-weight: 900;
  line-height: 34rpx;
}

.card.active .radio {
  border-color: var(--ld-mini-primary);
  background: var(--ld-mini-primary);
}
</style>
