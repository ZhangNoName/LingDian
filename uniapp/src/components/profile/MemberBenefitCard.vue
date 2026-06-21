<template>
  <view class="member">
    <text class="title">会员权益</text>
    <text class="desc">加入会员，充值就送好礼，充多送多。</text>
    <view class="stats">
      <view><text>订单数</text><strong>{{ member.orderCount }}</strong></view>
      <view><text>消费金额</text><strong>¥{{ member.consumptionAmount.toFixed(1) }}</strong></view>
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
.member {
  margin: 0 32rpx;
  padding: 36rpx;
  border-radius: 28rpx;
  background: linear-gradient(135deg, #ed1c24, #ff6b35);
  color: #ffffff;
}

.title,
.desc {
  display: block;
}

.title {
  font-size: 40rpx;
  font-weight: 900;
}

.desc {
  margin-top: 12rpx;
  color: rgba(255, 255, 255, 0.86);
  font-size: 26rpx;
}

.stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20rpx;
  margin-top: 28rpx;
}

.stats view {
  padding: 20rpx;
  border-radius: 20rpx;
  background: rgba(255, 255, 255, 0.16);
}

.stats text,
.stats strong {
  display: block;
}

.stats strong {
  margin-top: 8rpx;
  font-size: 40rpx;
}
</style>
