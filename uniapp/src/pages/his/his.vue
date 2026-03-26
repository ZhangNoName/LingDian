<template>
  <Layout active-tab="order">
    <view class="page">
      <view class="safe-top-spacer" />

      <view class="header">
        <text class="title">历史订单</text>
        <view class="back-btn" @tap="goBack">返回点餐</view>
      </view>

      <view class="tabs">
        <view
          v-for="item in tabList"
          :key="item.key"
          class="tab"
          :class="{ 'tab--active': currentTab === item.key }"
          @tap="currentTab = item.key"
        >
          {{ item.label }}
        </view>
      </view>

      <view class="list-wrap">
        <Card v-for="item in currentList" :key="item.no" :order="item" @action="onAction" />
      </view>
    </view>
  </Layout>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import Card from "../../components/card.vue";
import Layout from "../../layout/layout.vue";

type TabType = "all" | "history" | "refund";
type OrderStatus = "pending" | "finished" | "refund";

interface OrderItem {
  no: string;
  time: string;
  amount: string;
  status: OrderStatus;
}

const tabList: { key: TabType; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "history", label: "历史" },
  { key: "refund", label: "退单" },
];

const currentTab = ref<TabType>("all");

const orders = ref<OrderItem[]>([
  { no: "LD202603260001", time: "2026-03-26 11:20", amount: "28.90", status: "pending" },
  { no: "LD202603250021", time: "2026-03-25 19:42", amount: "39.80", status: "finished" },
  { no: "LD202603240018", time: "2026-03-24 14:16", amount: "22.00", status: "refund" },
  { no: "LD202603220012", time: "2026-03-22 12:15", amount: "31.90", status: "finished" },
]);

const currentList = computed(() => {
  if (currentTab.value === "history") {
    return orders.value.filter((item) => item.status === "finished");
  }
  if (currentTab.value === "refund") {
    return orders.value.filter((item) => item.status === "refund");
  }
  return orders.value;
});

function goBack() {
  const pages = getCurrentPages();
  if (pages.length > 1) {
    uni.navigateBack();
    return;
  }
  uni.reLaunch({ url: "/pages/order/order" });
}

function onAction(action: "detail" | "cancel" | "delete", orderNo: string) {
  const actionTextMap = {
    detail: "查看详情",
    cancel: "取消订单",
    delete: "删除订单",
  } as const;
  uni.showToast({
    title: `${actionTextMap[action]}：${orderNo}`,
    icon: "none",
  });
}
</script>

<style scoped>
.page {
  padding: 24rpx;
  box-sizing: border-box;
}

.safe-top-spacer {
  padding-top: var(--status-bar-height);
  padding-top: constant(safe-area-inset-top);
  padding-top: env(safe-area-inset-top);
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8rpx;
}

.title {
  font-size: 38rpx;
  font-weight: 700;
  color: #222222;
}

.back-btn {
  padding: 8rpx 20rpx;
  border-radius: 999rpx;
  font-size: 22rpx;
  color: #e02020;
  background-color: #ffecec;
}

.tabs {
  margin-top: 20rpx;
  display: flex;
  gap: 12rpx;
}

.tab {
  padding: 10rpx 20rpx;
  border-radius: 999rpx;
  font-size: 24rpx;
  color: #666666;
  background-color: #f1f1f1;
}

.tab--active {
  color: #ffffff;
  background-color: #e02020;
}

.list-wrap {
  margin-top: 18rpx;
}
</style>
