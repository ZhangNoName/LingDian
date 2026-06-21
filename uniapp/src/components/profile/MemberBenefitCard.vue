<template>
  <view class="member">
    <text class="title">会员权益</text>
    <text class="desc">加入会员，充值就送好礼，充多送多。</text>
    <view class="stats">
      <view>
        <text>我的余额</text>
        <strong>{{ assets.balance }}元</strong>
      </view>
      <view>
        <text>我的优惠券</text>
        <strong>{{ assets.couponCount }}张</strong>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import type { MemberAssets } from "@/types/member";

defineProps<{
  assets: MemberAssets;
}>();
</script>

<style scoped>
.member {
  margin: 0 var(--ld-page-padding, 24rpx);
  padding: var(--ld-card-padding, 24rpx);
  border-radius: var(--ld-radius-16, 16px);
  background: linear-gradient(135deg, #ed1c24, #ff6b35);
  color: #ffffff;
}

.title,
.desc {
  display: block;
}

.title {
  font-size: var(--ld-font-title-lg, 36rpx);
  font-weight: 900;
}

.desc {
  margin-top: 12rpx;
  color: rgba(255, 255, 255, 0.86);
  font-size: var(--ld-font-base, 26rpx);
}

.stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--ld-card-gap, 20rpx);
  margin-top: 22rpx;
}

.stats view {
  padding: 18rpx;
  border-radius: var(--ld-radius-8, 8px);
  background: rgba(255, 255, 255, 0.16);
}

.stats text,
.stats strong {
  display: block;
}

.stats strong {
  margin-top: 8rpx;
  font-size: var(--ld-font-title-lg, 36rpx);
}
</style>
