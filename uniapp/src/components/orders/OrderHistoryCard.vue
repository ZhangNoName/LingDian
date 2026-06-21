<template>
  <view class="card" @tap="$emit('detail', order.id)">
    <view class="title-row">
      <text class="badge">堂食</text>
      <text class="store">{{ order.storeName }}</text>
      <text class="status">{{ statusLabel }} ›</text>
    </view>
    <text class="time">{{ order.createdAt }}</text>
    <view class="body">
      <view class="thumbs">
        <image v-for="thumb in order.productThumbs" :key="thumb" class="thumb" :src="thumb" mode="aspectFill" />
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
</script>

<style scoped>
.card {
  margin: 24rpx;
  padding: 32rpx;
  border-radius: 24rpx;
  background: #ffffff;
}

.title-row {
  display: flex;
  align-items: center;
  gap: 14rpx;
}

.badge {
  padding: 6rpx 12rpx;
  border-radius: 10rpx;
  background: #00645c;
  color: #ffffff;
  font-size: 26rpx;
}

.store {
  flex: 1;
  overflow: hidden;
  color: var(--ld-mini-text);
  font-size: 34rpx;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status,
.time,
.count {
  color: #999999;
  font-size: 28rpx;
}

.time {
  display: block;
  margin: 18rpx 0 34rpx;
}

.body {
  display: grid;
  grid-template-columns: 1fr 190rpx;
  gap: 20rpx;
  align-items: center;
}

.thumbs {
  display: flex;
  gap: 24rpx;
}

.thumb {
  width: 160rpx;
  height: 118rpx;
  border-radius: 18rpx;
  background: #ffffff;
}

.summary {
  text-align: right;
}

.price {
  display: block;
  color: var(--ld-mini-text);
  font-size: 44rpx;
  font-weight: 900;
}

.count {
  display: block;
  margin: 10rpx 0 42rpx;
}

.again {
  width: 172rpx;
  height: 72rpx;
  margin: 0;
  padding: 0;
  border-radius: 8rpx;
  background: var(--ld-mini-primary);
  color: #ffffff;
  font-size: 30rpx;
  font-weight: 800;
  line-height: 72rpx;
}

.again::after {
  border: 0;
}
</style>
