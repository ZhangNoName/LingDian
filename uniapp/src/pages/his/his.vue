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
      <button v-if="hasMore" class="load-more" :loading="loadingMore" @tap="loadMore">
        {{ loadingMore ? "加载中…" : "加载更多" }}
      </button>
      <view v-if="!loadingMore && filteredOrders.length === 0 && !hasMore" class="empty">
        <text class="empty-title">{{ activeTab === "current" ? "暂无当前订单" : "暂无历史订单" }}</text>
        <text class="empty-copy">挑选喜欢的餐品，下单后可在这里查看进度</text>
        <AppActionButton @activate="goMenu">去点餐</AppActionButton>
      </view>
    </view>
  </Layout>
</template>

<script setup lang="ts">
import AppActionButton from "@/components/app/AppActionButton.vue";
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
const page = ref(1);
const total = ref(0);
const loadingMore = ref(false);
const pageSize = 20;
const historyStatuses = new Set(["finished", "cancelled", "failed", "timedOut", "refunded"]);
const hasMore = computed(() => page.value * pageSize < total.value);
let generation = 0;

const filteredOrders = computed(() => {
  return orders.value.filter((order) => {
    const isHistory = historyStatuses.has(order.status);
    return activeTab.value === "history" ? isHistory : !isHistory;
  });
});

onShow(async () => {
  const current = ++generation;
  loadingMore.value = true;
  try {
    if (!(await requireCustomerAuth("/pages/his/his")) || current !== generation) return;
    const result = await fetchOrders(1, pageSize);
    if (current !== generation) return;
    orders.value = result.items;
    page.value = result.page;
    total.value = result.total;
  } catch (error) {
    if (current !== generation) return;
    uni.showToast({ title: error instanceof Error ? error.message : "订单加载失败", icon: "none" });
  } finally {
    if (current === generation) loadingMore.value = false;
  }
});

async function loadMore() {
  if (loadingMore.value || !hasMore.value) return;
  const current = generation;
  loadingMore.value = true;
  try {
    const result = await fetchOrders(page.value + 1, pageSize);
    if (current !== generation) return;
    const existingIds = new Set(orders.value.map((order) => order.id));
    orders.value.push(...result.items.filter((order) => !existingIds.has(order.id)));
    page.value = result.page;
    total.value = result.total;
  } catch (error) {
    if (current !== generation) return;
    uni.showToast({ title: error instanceof Error ? error.message : "订单加载失败", icon: "none" });
  } finally {
    if (current === generation) loadingMore.value = false;
  }
}

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

.load-more {
  width: calc(100% - 48rpx);
  height: 72rpx;
  margin: 24rpx auto;
  border-radius: 999rpx;
  background: #ffffff;
  color: var(--ld-mini-primary);
  font-size: 26rpx;
  line-height: 72rpx;
}

.load-more::after {
  border-color: #e5e5e5;
}
</style>
