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
  gap: var(--ld-card-gap, 20rpx);
  padding: 0 var(--ld-page-padding, 24rpx) 22rpx;
}

.avatar {
  width: 96rpx;
  height: 96rpx;
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
  color: #777777;
  font-size: var(--ld-font-base, 26rpx);
}
</style>
