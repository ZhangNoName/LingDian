<template>
  <view class="header">
    <SkeletonBox class="avatar" radius="round" />
    <view>
      <text class="level">{{ member.levelName }}</text>
      <text class="phone">{{ user.maskedPhone }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import SkeletonBox from "@/components/app/SkeletonBox.vue";
import type { MemberSummary, UserProfile } from "@/types/member";

defineProps<{
  user: UserProfile;
  member: MemberSummary;
}>();
</script>

<style scoped>
.header {
  display: flex;
  align-items: center;
  gap: 24rpx;
  padding: 0 32rpx 28rpx;
}

.avatar {
  width: 112rpx;
  height: 112rpx;
}

.level,
.phone {
  display: block;
}

.level {
  color: var(--ld-mini-text);
  font-size: 34rpx;
  font-weight: 900;
}

.phone {
  margin-top: 8rpx;
  color: #777777;
  font-size: 26rpx;
}
</style>
