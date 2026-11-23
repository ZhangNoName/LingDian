<template>
  <view class="card" :class="'order-' + order.status" @tap="$emit('detail', order.id)">
    <view class="title-row">
      <text class="badge">{{ serviceModeLabel }}</text>
      <text class="store">{{ order.storeName }}</text>
      <view class="status-wrap">
        <text class="status">{{ statusLabel }}</text>
      </view>
    </view>
    <view class="meta-row">
      <text class="time">{{ formatOrderTime(order.createdAt) }}</text>
    </view>
    <view v-if="order.pickupCardCode" class="pickup-strip">
      <text class="pickup-label">{{ order.pickupCodeLabel }}</text>
      <text class="pickup-code">{{ order.pickupCardCode }}</text>
    </view>
    <view class="body">
      <view v-if="order.productThumbs.length" class="thumbs">
        <image v-for="thumb in order.productThumbs.slice(0, 3)" :key="thumb" class="thumb" :src="thumb" mode="aspectFill" lazy-load />
      </view>
      <view class="summary">
        <text class="price">¥{{ formatAmount(order.totalAmount) }}</text>
        <text class="count">共{{ order.itemCount }}件</text>
        <AppActionButton size="small" @activate="emitAction">{{ actionLabel }}</AppActionButton>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { formatAmount } from "@/utils/money";
import AppActionButton from "@/components/app/AppActionButton.vue";
import { computed } from "vue";
import type { OrderSummary } from "@/types/order";
import { formatOrderTime } from "@/utils/order-presentation";

const props = defineProps<{
  order: OrderSummary;
}>();

const emit = defineEmits<{
  (event: "reorder", orderId: string): void;
  (event: "detail", orderId: string): void;
}>();

const serviceModeLabel = computed(() => ({
  dineIn: "堂食",
  takeaway: "自取",
  delivery: "配送",
})[props.order.serviceMode]);

const statusLabel = computed(() => {
  const labels: Record<OrderSummary["status"], string> = {
    pendingPay: "待支付",
    paid: "已支付",
    making: "制作中",
    ready: props.order.serviceMode === "delivery" ? "待配送" : "待取餐",
    finished: "已完成",
    cancelled: "已取消",
    failed: "失败",
    timedOut: "已超时",
    refunding: "退款中",
    refunded: "已退款",
    unknown: "状态待刷新",
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
  --order-tone-bg: var(--ld-mini-neutral-bg);
  --order-tone-text: var(--ld-mini-neutral-text);
  margin: var(--ld-page-padding, 24rpx);
  padding: var(--ld-card-padding, 24rpx);
  border-radius: var(--ld-radius-16, 16px);
  border: 1rpx solid var(--ld-mini-border);
  background: var(--ld-mini-surface);
}

.order-making, .order-pendingPay, .order-refunding {
  --order-tone-bg: var(--ld-mini-warning-bg);
  --order-tone-text: var(--ld-mini-warning-text);
}
.order-ready, .order-failed {
  --order-tone-bg: var(--ld-mini-primary-soft);
  --order-tone-text: var(--ld-mini-primary-pressed);
}
.order-finished {
  --order-tone-bg: var(--ld-mini-success-bg);
  --order-tone-text: var(--ld-mini-success-text);
}
.order-paid {
  --order-tone-bg: var(--ld-mini-info-bg);
  --order-tone-text: var(--ld-mini-info-text);
}

.title-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.badge {
  padding: 4rpx 10rpx;
  border-radius: 10rpx;
  background: var(--ld-mini-neutral-bg);
  color: var(--ld-mini-neutral-text);
  white-space: nowrap;
  font-size: var(--ld-font-xs, 22rpx);
}

.store {
  flex: 1;
  overflow: hidden;
  color: var(--ld-mini-text);
  font-size: var(--ld-font-md);
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.time,
.count {
  color: var(--ld-mini-text-muted);
  font-size: var(--ld-font-sm, 24rpx);
}

.status-wrap {
  flex: none;
}

.status {
  padding: 4rpx 10rpx;
  border-radius: 8rpx;
  background: var(--order-tone-bg);
  color: var(--order-tone-text);
  font-size: var(--ld-font-xs);
  font-weight: 700;
  white-space: nowrap;
}

.time {
  flex: none;
}

.meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6rpx 20rpx;
  align-items: flex-start;
  justify-content: space-between;
  margin: 14rpx 0 18rpx;
}

.pickup-strip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10rpx;
  margin-bottom: 14rpx;
  padding: 12rpx 16rpx;
  border-radius: var(--ld-radius-8);
  background: var(--order-tone-bg);
  color: var(--order-tone-text);
}

.pickup-label { flex: none; font-size: var(--ld-font-sm); }

.pickup-code {
  min-width: 0;
  font-size: 40rpx;
  font-weight: 850;
  font-variant-numeric: tabular-nums;
  text-align: end;
  overflow-wrap: anywhere;
}

.body {
  display: flex;
  justify-content: space-between;
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
  flex: 1;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 8rpx 14rpx;
}

.price {
  display: block;
  color: var(--ld-mini-text);
  font-size: var(--ld-font-price, 36rpx);
  font-weight: 900;
}

.count {
  margin-right: auto;
}
</style>
