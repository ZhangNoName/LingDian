<template>
  <Layout active="orders">
    <view class="page">
      <AppNavBar show-back @back="goHome" />
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
import AppNavBar from "@/components/app/AppNavBar.vue";
import OrderHistoryCard from "@/components/orders/OrderHistoryCard.vue";
import OrderStatusTabs from "@/components/orders/OrderStatusTabs.vue";
import { orders } from "@/data/mock";
import Layout from "@/layout/layout.vue";

const activeTab = ref<"current" | "history">("current");

const historyStatuses = new Set(["finished", "cancelled", "refunded"]);

const filteredOrders = computed(() => {
  return orders.filter((order) => {
    const isHistory = historyStatuses.has(order.status);
    return activeTab.value === "history" ? isHistory : !isHistory;
  });
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
  min-height: 100vh;
  background: #f3f3f3;
}

.empty {
  display: grid;
  place-items: center;
  min-height: 360rpx;
  color: var(--ld-mini-text-muted);
  font-size: 30rpx;
}
</style>
