<template>
  <view class="card">
    <text class="title">订单信息</text>
    <view v-for="row in rows" :key="row.label" class="row">
      <text class="label">{{ row.label }}</text>
      <view class="value-wrap">
        <text class="value">{{ row.value }}</text>
        <CopyIcon v-if="row.copyable" class="copy" aria-hidden="true" />
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { CopyIcon } from "@lingdian/icons/miniapp";
import type { OrderInfoRow } from "@/types/order";

defineProps<{
  rows: OrderInfoRow[];
}>();
</script>

<style scoped>
.card {
  margin: var(--ld-page-padding, 24rpx);
  padding: var(--ld-card-padding, 24rpx);
  border-radius: var(--ld-radius-16, 16px);
  background: #ffffff;
}

.title {
  display: block;
  margin-bottom: 18rpx;
  color: var(--ld-mini-text);
  font-size: var(--ld-font-title, 32rpx);
  font-weight: 900;
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 72rpx;
  border-top: 1rpx solid #eeeeee;
}

.row:first-of-type {
  border-top: 0;
}

.label {
  color: #777777;
  font-size: var(--ld-font-base, 26rpx);
}

.value-wrap {
  display: flex;
  align-items: center;
  gap: 10rpx;
  max-width: 440rpx;
}

.value {
  color: var(--ld-mini-text);
  font-size: var(--ld-font-base, 26rpx);
  text-align: right;
}

.copy {
  display: block;
  width: 28rpx;
  height: 28rpx;
  color: #c4c4c4;
  font-size: 28rpx;
  line-height: 28rpx;
}
</style>
