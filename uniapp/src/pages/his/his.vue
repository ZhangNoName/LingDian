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
        <text>{{ activeTab === "current" ? "暂无当前订单" : "暂无历史订单" }}</text>
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
import { fetchOrders } from "@/services/orders";
import Layout from "@/layout/layout.vue";
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
  min-height: 240rpx;
  color: var(--ld-mini-text-muted);
  font-size: var(--ld-font-base, 26rpx);
}
</style>

