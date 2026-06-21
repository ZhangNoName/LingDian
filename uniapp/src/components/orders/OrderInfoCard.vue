<template>
  <view class="card">
    <text class="title">订单信息</text>
    <view v-for="row in rows" :key="row.label" class="row">
      <text class="label">{{ row.label }}</text>
      <view class="value-wrap">
        <text class="value">{{ row.value }}</text>
        <text v-if="row.copyable" class="copy">▢</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import type { OrderInfoRow } from "@/types/order";

defineProps<{
  rows: OrderInfoRow[];
}>();
</script>

<style scoped>
.card {
  margin: 24rpx;
  padding: 32rpx;
  border-radius: 24rpx;
  background: #ffffff;
}

.title {
  display: block;
  margin-bottom: 26rpx;
  color: var(--ld-mini-text);
  font-size: 34rpx;
  font-weight: 900;
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 92rpx;
  border-top: 1rpx solid #eeeeee;
}

.row:first-of-type {
  border-top: 0;
}

.label {
  color: #777777;
  font-size: 30rpx;
}

.value-wrap {
  display: flex;
  align-items: center;
  gap: 12rpx;
  max-width: 440rpx;
}

.value {
  color: var(--ld-mini-text);
  font-size: 30rpx;
  text-align: right;
}

.copy {
  color: #c4c4c4;
  font-size: 34rpx;
}
</style>
