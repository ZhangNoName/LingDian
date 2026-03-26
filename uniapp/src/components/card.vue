<template>
  <view class="order-card">
    <view class="row">
      <text class="order-no">订单号：{{ order.no }}</text>
      <text class="order-status" :class="statusClass">{{ statusLabel }}</text>
    </view>

    <text class="order-time">下单时间：{{ order.time }}</text>
    <text class="order-amount">订单金额：￥{{ order.amount }}</text>

    <view class="actions">
      <view class="btn btn-ghost" @tap="emitAction('detail')">查看详情</view>
      <view v-if="order.status === 'pending'" class="btn btn-warn" @tap="emitAction('cancel')">取消订单</view>
      <view class="btn btn-danger" @tap="emitAction('delete')">删除订单</view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue";

type OrderStatus = "pending" | "finished" | "refund";
type OrderAction = "detail" | "cancel" | "delete";

const props = defineProps<{
  order: {
    no: string;
    time: string;
    amount: string;
    status: OrderStatus;
  };
}>();

const emit = defineEmits<{
  (e: "action", action: OrderAction, orderNo: string): void;
}>();

const statusLabel = computed(() => {
  if (props.order.status === "pending") return "待处理";
  if (props.order.status === "refund") return "已退款";
  return "已完成";
});

const statusClass = computed(() => {
  return {
    "order-status--pending": props.order.status === "pending",
    "order-status--refund": props.order.status === "refund",
  };
});

function emitAction(action: OrderAction) {
  emit("action", action, props.order.no);
}
</script>

<style scoped>
.order-card {
  margin-bottom: 16rpx;
  padding: 22rpx;
  border-radius: 14rpx;
  background-color: #ffffff;
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.order-no {
  font-size: 24rpx;
  color: #333333;
}

.order-status {
  font-size: 24rpx;
  color: #1fa75b;
}

.order-status--pending {
  color: #e58a00;
}

.order-status--refund {
  color: #e02020;
}

.order-time,
.order-amount {
  display: block;
  margin-top: 10rpx;
  font-size: 24rpx;
  color: #666666;
}

.actions {
  margin-top: 16rpx;
  display: flex;
  gap: 12rpx;
}

.btn {
  padding: 8rpx 18rpx;
  border-radius: 999rpx;
  font-size: 22rpx;
}

.btn-ghost {
  color: #555555;
  background-color: #f2f2f2;
}

.btn-warn {
  color: #ffffff;
  background-color: #f0a020;
}

.btn-danger {
  color: #ffffff;
  background-color: #e02020;
}
</style>
