<template>
  <view class="member-strip">
    <text class="name">张新阳</text>
    <view class="metric">
      <text class="metric-value">{{ member.points }}</text>
      <text class="metric-label">积分</text>
    </view>
    <view class="metric">
      <text class="metric-value">{{ member.couponCount }}</text>
      <text class="metric-label">优惠券</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import type { MemberSummary } from "@/types/member";

defineProps<{
  member: MemberSummary;
}>();
</script>

<style scoped>
.member-strip {
  display: grid;
  grid-template-columns: 1fr 160rpx 160rpx;
  align-items: center;
  min-height: 112rpx;
  margin: 0;
  padding: 0 var(--ld-card-padding, 24rpx);
  border-radius: var(--ld-radius-16, 16px);
  background: #65140d;
  color: #ffe5b0;
  font-size: var(--ld-font-base, 26rpx);
}

.metric {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.metric-value {
  text-align: right;
  color: #ffffff;
  font-size: var(--ld-font-md, 28rpx);
  font-weight: 800;
}

.metric-label {
  margin-top: 2rpx;
  color: rgba(255, 229, 176, 0.84);
  font-size: var(--ld-font-xs, 22rpx);
}

.name {
  color: #ffffff;
  text-align: left !important;
  font-weight: 800;
}
</style>
