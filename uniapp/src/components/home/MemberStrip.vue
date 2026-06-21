<template>
  <view class="member-strip">
    <text class="name">张新阳</text>
    <text>{{ member.points }} 积分</text>
    <text>{{ member.couponCount }} 优惠券</text>
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
  min-height: 144rpx;
  margin: 0 24rpx;
  padding: 0 32rpx;
  border-radius: 20rpx 20rpx 0 0;
  background: linear-gradient(90deg, #631000, #370700);
  color: #ffe5b0;
  font-size: 28rpx;
}

.member-strip text {
  text-align: right;
}

.name {
  color: #ffffff;
  text-align: left !important;
  font-weight: 800;
}
</style>
