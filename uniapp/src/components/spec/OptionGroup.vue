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
  padding: 0 32rpx;
}

.title {
  display: block;
  margin-bottom: 24rpx;
  color: #777777;
  font-size: 28rpx;
}

.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20rpx;
}

.card {
  position: relative;
  min-height: 274rpx;
  padding: 18rpx 14rpx 60rpx;
  border: 1rpx solid #eeeeee;
  border-radius: 14rpx;
  background: #ffffff;
  text-align: center;
}

.card.active {
  border-color: #b9934b;
}

.image {
  width: 148rpx;
  height: 108rpx;
  margin: 0 auto 16rpx;
  border-radius: 14rpx;
}

.name {
  color: var(--ld-mini-text);
  font-size: 24rpx;
  line-height: 1.35;
}

.radio {
  position: absolute;
  right: 20rpx;
  bottom: 20rpx;
  width: 44rpx;
  height: 44rpx;
  border: 4rpx solid #e3e3e3;
  border-radius: 50%;
  color: #ffffff;
  font-size: 28rpx;
  font-weight: 900;
  line-height: 38rpx;
}

.card.active .radio {
  border-color: var(--ld-mini-primary);
  background: var(--ld-mini-primary);
}
</style>
