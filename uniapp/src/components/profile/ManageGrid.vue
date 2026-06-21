<template>
  <view class="manage">
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
  margin: var(--ld-page-padding, 24rpx) var(--ld-page-padding, 24rpx) 0;
  padding: var(--ld-card-padding, 24rpx);
  border-radius: var(--ld-radius-16, 16px);
  background: #ffffff;
  box-shadow: var(--ld-mini-shadow-card);
}

.grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0;
}

.entry {
  position: relative;
  text-align: center;
}

.entry:not(:last-child)::after {
  position: absolute;
  right: 0;
  top: 6rpx;
  width: 1rpx;
  height: 72rpx;
  background: rgba(23, 23, 23, 0.08);
  content: "";
}

.icon {
  width: 56rpx;
  height: 56rpx;
  margin: 0 auto 12rpx;
}

.entry text {
  color: var(--ld-mini-text);
  font-size: var(--ld-font-sm, 24rpx);
  font-weight: 700;
}
</style>
