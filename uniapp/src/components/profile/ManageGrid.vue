<template>
  <view class="manage">
    <text class="title">常用管理</text>
    <view class="grid">
      <view v-for="entry in entries" :key="entry.key" class="entry">
        <SkeletonBox class="icon" radius="round" />
        <text>{{ entry.label }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import SkeletonBox from "@/components/app/SkeletonBox.vue";
import type { ManageEntry } from "@/types/member";

defineProps<{
  entries: ManageEntry[];
}>();
</script>

<style scoped>
.manage {
  margin: 0 32rpx;
  padding: 32rpx;
  border-radius: 24rpx;
  background: #ffffff;
  box-shadow: var(--ld-mini-shadow-card);
}

.title {
  display: block;
  margin-bottom: 30rpx;
  color: var(--ld-mini-text);
  font-size: 34rpx;
  font-weight: 900;
}

.grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 18rpx;
}

.entry {
  text-align: center;
}

.icon {
  width: 68rpx;
  height: 68rpx;
  margin: 0 auto 14rpx;
}

.entry text {
  color: var(--ld-mini-text);
  font-size: 24rpx;
  font-weight: 700;
}
</style>
