<template>
  <Layout active="orders">
    <view class="page">
      <AppNavBar title="订单" show-back @back="goHome" />
      <OrderStatusTabs :active="activeTab" @change="activeTab = $event" />
      <OrderHistoryCard
        v-for="order in filteredOrders"
        :key="order.id"
        :order="order"
        @detail="goDetail"
        @reorder="goMenu"
      />
      <view v-if="filteredOrders.length === 0" class="empty">
        <text class="empty-title">{{ activeTab === "current" ? "暂无当前订单" : "暂无历史订单" }}</text>
        <text class="empty-copy">挑选喜欢的餐品，下单后可在这里查看进度</text>
        <button class="empty-action" role="button" tabindex="0" @keydown.enter="goMenu" @tap="goMenu">去点餐</button>
      </view>
    </view>
  </Layout>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import AppNavBar from "@/components/app/AppNavBar.vue";
import OrderHistoryCard from "@/components/orders/OrderHistoryCard.vue";
import OrderStatusTabs from "@/components/orders/OrderStatusTabs.vue";
import Layout from "@/layout/layout.vue";
import { requireCustomerAuth } from "@/services/auth-navigation";
import { fetchOrders } from "@/services/orders";
import type { OrderSummary } from "@/types/order";

const activeTab = ref<"current" | "history">("current");
const orders = ref<OrderSummary[]>([]);
const historyStatuses = new Set(["finished", "cancelled", "refunded"]);

const filteredOrders = computed(() => {
  return orders.value.filter((order) => {
    const isHistory = historyStatuses.has(order.status);
    return activeTab.value === "history" ? isHistory : !isHistory;
  });
});

onShow(async () => {
  if (!(await requireCustomerAuth("/pages/his/his"))) return;
  try {
    orders.value = await fetchOrders();
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : "订单加载失败", icon: "none" });
  }
});

function goHome() {
  uni.redirectTo({ url: "/pages/home/home" });
}

function goMenu() {
  uni.redirectTo({ url: "/pages/order/order" });
}

function goDetail(orderId: string) {
  uni.navigateTo({ url: `/pages/order-detail/order-detail?id=${orderId}` });
}
</script>

<style scoped>
.page {
  min-height: 100%;
  background: #f3f3f3;
}

.empty {
  display: grid;
  place-items: center;
  min-height: 320rpx;
  padding: 32rpx;
  text-align: center;
}

.empty-title {
  color: var(--ld-mini-text);
  font-size: 28rpx;
  font-weight: 800;
}

.empty-copy {
  margin-top: 12rpx;
  color: #666666;
  font-size: 24rpx;
}

.empty-action {
  height: 68rpx;
  margin-top: 28rpx;
  padding: 0 34rpx;
  border-radius: 999rpx;
  background: var(--ld-mini-primary);
  color: #ffffff;
  font-size: 26rpx;
  font-weight: 800;
  line-height: 68rpx;
}

.empty-action::after {
  border: 0;
}
</style>
