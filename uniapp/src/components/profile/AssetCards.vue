<template>
  <view class="assets">
    <view class="asset asset-balance">
      <strong>{{ assets.balance }}元</strong>
      <text>我的余额 ›</text>
      <text class="pill">去充值</text>
    </view>
    <view class="asset asset-coupon">
      <strong>{{ assets.couponCount }}张</strong>
      <text>我的优惠券 ›</text>
      <text class="pill">{{ assets.couponCount }}张 待领取</text>
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
.assets {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24rpx;
  margin: 24rpx 32rpx;
}

.asset {
  position: relative;
  overflow: hidden;
  min-height: 208rpx;
  padding: 32rpx;
  border: 1rpx solid rgba(237, 28, 36, 0.1);
  border-radius: 24rpx;
  box-shadow: 0 20rpx 44rpx rgba(44, 24, 18, 0.1);
}

.asset::after {
  position: absolute;
  right: -28rpx;
  top: -28rpx;
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.48);
  content: "";
}

.asset-balance {
  background: linear-gradient(135deg, #fff5e6 0%, #ffffff 56%, #fff0f1 100%);
}

.asset-coupon {
  background: linear-gradient(135deg, #fff1f1 0%, #ffffff 58%, #fff7df 100%);
}

.asset strong,
.asset text {
  position: relative;
  z-index: 1;
  display: block;
}

.asset strong {
  color: var(--ld-mini-primary, #ed1c24);
  font-size: 42rpx;
}

.asset text {
  margin-top: 20rpx;
  color: var(--ld-mini-text);
  font-size: 28rpx;
  font-weight: 800;
}

.asset .pill {
  height: 54rpx;
  border-radius: 999rpx;
  background: rgba(237, 28, 36, 0.1);
  color: var(--ld-mini-primary, #ed1c24);
  text-align: center;
  font-size: 24rpx;
  line-height: 54rpx;
}
</style>
