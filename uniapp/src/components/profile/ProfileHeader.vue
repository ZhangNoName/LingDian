<template>
  <view class="header">
    <button class="avatar-button" open-type="chooseAvatar" aria-label="选择头像" @chooseavatar="$emit('choose-avatar', $event)">
      <image v-if="avatarUrl" class="avatar-image" :src="avatarUrl" mode="aspectFill" />
      <SkeletonBox v-else class="avatar" radius="round" />
    </button>
    <view>
      <text class="level">{{ presentation.displayName }}</text>
      <text class="phone">{{ presentation.secondaryText }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import SkeletonBox from "@/components/app/SkeletonBox.vue";
import type { CustomerPresentation } from "@/services/customer-presentation";

defineProps<{
  presentation: CustomerPresentation;
  avatarUrl?: string | null;
}>();

defineEmits<{
  (event: "choose-avatar", value: unknown): void;
}>();
</script>

<style scoped>
.header {
  display: flex;
  align-items: center;
  gap: var(--ld-card-gap, 20rpx);
  padding: 0 var(--ld-page-padding, 24rpx) 22rpx;
}

.avatar {
  width: 96rpx;
  height: 96rpx;
}

.avatar-button {
  width: 96rpx;
  height: 96rpx;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  line-height: 1;
  overflow: hidden;
}

.avatar-button::after {
  border: 0;
}

.avatar-image {
  display: block;
  width: 96rpx;
  height: 96rpx;
  border-radius: 50%;
}

.level,
.phone {
  display: block;
}

.level {
  color: var(--ld-mini-text);
  font-size: var(--ld-font-title, 32rpx);
  font-weight: 900;
}

.phone {
  margin-top: 8rpx;
  color: #666666;
  font-size: var(--ld-font-base, 26rpx);
}
</style>
