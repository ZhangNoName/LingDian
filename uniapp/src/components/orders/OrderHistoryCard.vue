<template>
  <view class="card" @tap="$emit('detail', order.id)">
    <view class="title-row">
      <text class="badge">堂食</text>
      <text class="store">{{ order.storeName }}</text>
      <view class="status-wrap">
        <text class="status">{{ statusLabel }}</text>
        <ChevronRightIcon class="status-icon" :stroke-width="2.2" />
      </view>
    </view>
    <text class="time">{{ formatOrderTime(order.createdAt) }}</text>
    <view class="body">
      <view class="thumbs">
        <image v-for="thumb in order.productThumbs.slice(0, 3)" :key="thumb" class="thumb" :src="thumb" mode="aspectFill" />
      </view>
      <view class="summary">
        <text class="price">¥{{ order.totalAmount.toFixed(1) }}</text>
        <text class="count">共{{ order.itemCount }}件</text>
        <button class="again" @tap.stop="emitAction">{{ actionLabel }}</button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { ChevronRightIcon } from "@lingdian/icons/miniapp";
import type { OrderSummary } from "@/types/order";

const props = defineProps<{
  order: OrderSummary;
}>();

const emit = defineEmits<{
  (event: "reorder", orderId: string): void;
  (event: "detail", orderId: string): void;
}>();

const statusLabel = computed(() => {
  const labels: Record<OrderSummary["status"], string> = {
    pendingPay: "待支付",
    paid: "已支付",
    making: "制作中",
    ready: "待取餐",
    finished: "已完成",
    cancelled: "已取消",
    refunding: "退款中",
    refunded: "已退款",
  };

  return labels[props.order.status];
});

const actionLabel = computed(() => {
  return props.order.status === "finished" ? "再来一单" : "查看详情";
});

function emitAction() {
  if (props.order.status === "finished") {
    emit("reorder", props.order.id);
    return;
  }

  emit("detail", props.order.id);
}

function formatOrderTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day} ${hours}:${minutes}`;
}
</script>

<style scoped>
.card {
  margin: var(--ld-page-padding, 24rpx);
  padding: var(--ld-card-padding, 24rpx);
  border-radius: var(--ld-radius-16, 16px);
  background: #ffffff;
  box-shadow: var(--ld-mini-shadow-float);
}

.title-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.badge {
  padding: 4rpx 10rpx;
  border-radius: 10rpx;
  background: #00645c;
  color: #ffffff;
  font-size: var(--ld-font-xs, 22rpx);
}

.store {
  flex: 1;
  overflow: hidden;
  color: var(--ld-mini-text);
  font-size: var(--ld-font-title, 32rpx);
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status,
.time,
.count {
  color: #999999;
  font-size: var(--ld-font-sm, 24rpx);
}

.status-wrap {
  display: flex;
  align-items: center;
  gap: 2rpx;
}

.status-icon {
  width: 26rpx;
  height: 26rpx;
  color: #999999;
}

.time {
  display: block;
  margin: 14rpx 0 18rpx;
}

.body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 148rpx;
  gap: var(--ld-card-gap, 20rpx);
  align-items: center;
}

.thumbs {
  display: flex;
  overflow: hidden;
  gap: 12rpx;
}

.thumb {
  width: 112rpx;
  height: 84rpx;
  border-radius: var(--ld-radius-8, 8px);
  background: #ffffff;
}

.summary {
  display: flex;
  min-height: 88rpx;
  flex-direction: column;
  justify-content: center;
  align-items: flex-end;
  text-align: right;
}

.price {
  display: block;
  color: var(--ld-mini-text);
  font-size: var(--ld-font-price, 36rpx);
  font-weight: 900;
}

.count {
  display: block;
  margin: 4rpx 0 10rpx;
}

.again {
  width: 148rpx;
  height: 52rpx;
  margin: 0;
  padding: 0;
  border-radius: 8rpx;
  background: var(--ld-mini-primary);
  color: #ffffff;
  font-size: var(--ld-font-sm, 24rpx);
  font-weight: 800;
  line-height: 52rpx;
}

.again::after {
  border: 0;
}
</style>
