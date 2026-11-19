<template>
  <Layout :show-tab-bar="false">
    <view class="page">
      <AppNavBar title="订单详情" show-back @back="goBack" />

      <view v-if="loadError" class="empty">
        <text>{{ loadError }}</text>
        <AppActionButton size="small" variant="outline" @activate="loadDetail">重试</AppActionButton>
      </view>
      <view v-else-if="detail" class="content">
        <view class="status-block">
          <text class="status-title">{{ statusTitle }}</text>
          <AppActionButton v-if="['pendingPay', 'paid', 'making', 'ready', 'refunding', 'unknown'].includes(detail.status)" size="small" variant="outline" :loading="loading" @activate="loadDetail">刷新状态</AppActionButton>
          <view v-if="detail.rewardPoints != null" class="reward">本单获得{{ detail.rewardPoints }}积分</view>
        </view>

        <OrderDetailGoodsCard :detail="detail" />
        <OrderInfoCard :rows="detail.infoRows" />
      </view>

      <view v-else class="empty">正在加载订单…</view>
      <view v-if="!loadError && detail?.status === 'finished'" class="bottom">
        <AppActionButton variant="outline" @activate="goMenu">再来一单</AppActionButton>
      </view>
    </view>
  </Layout>
</template>

<script setup lang="ts">
import AppActionButton from "@/components/app/AppActionButton.vue";
import { computed, ref } from "vue";
import { onLoad, onShow, onHide } from "@dcloudio/uni-app";
import AppNavBar from "@/components/app/AppNavBar.vue";
import Layout from "@/layout/layout.vue";
import OrderDetailGoodsCard from "@/components/orders/OrderDetailGoodsCard.vue";
import OrderInfoCard from "@/components/orders/OrderInfoCard.vue";
import { fetchOrderDetail } from "@/services/orders";
import { navigateBackOrRedirect, requireCustomerAuth } from "@/services/auth-navigation";
import type { OrderDetail } from "@/types/order";

const detail = ref<OrderDetail | null>(null);

const statusTitle = computed(() => {
  if (!detail.value) return "";
  const labels: Record<OrderDetail["status"], string> = {
    pendingPay: "订单待支付",
    paid: "订单已支付",
    making: "订单制作中",
    ready: "订单待取餐",
    finished: "订单已完成",
    cancelled: "订单已取消",
    failed: "订单失败",
    timedOut: "订单已超时",
    refunding: "订单退款中",
    refunded: "订单已退款",
    unknown: "订单状态待刷新",
  };
  return labels[detail.value.status];
});

const orderId = ref("");
const loadError = ref("");
const loading = ref(false);
let sequence = 0;

onLoad((query) => { orderId.value = typeof query?.id === "string" ? query.id : ""; });
onShow(() => { void loadDetail(); });
onHide(() => { sequence++; loading.value = false; detail.value = null; });

async function loadDetail() {
  if (loading.value) return;
  const current = ++sequence;
  loading.value = true;
  loadError.value = "";
  try {
    if (!orderId.value) throw new Error("缺少订单编号");
    const returnUrl = `/pages/order-detail/order-detail?id=${encodeURIComponent(orderId.value)}`;
    if (!(await requireCustomerAuth(returnUrl)) || current !== sequence) return;
    const result = await fetchOrderDetail(orderId.value);
    if (current === sequence) detail.value = result;
  } catch (error) {
    if (current === sequence) loadError.value = error instanceof Error ? error.message : "订单加载失败";
  } finally {
    if (current === sequence) loading.value = false;
  }
}

function goBack() {
  navigateBackOrRedirect("/pages/his/his");
}

function goMenu() {
  uni.redirectTo({ url: "/pages/order/order" });
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  padding-bottom: calc(var(--ld-fixed-action-height, 128rpx) + var(--ld-page-bottom-safe, 24rpx));
  background: #f3f3f3;
}

.content {
  padding-bottom: var(--ld-page-padding, 24rpx);
}

.status-block {
  position: relative;
  padding: 20rpx 40rpx 18rpx;
}

.status-title {
  display: block;
  color: var(--ld-mini-text);
  font-size: var(--ld-font-title-lg, 36rpx);
  font-weight: 900;
}

.reward {
  display: inline-flex;
  margin-top: 14rpx;
  padding: 8rpx 16rpx;
  border-radius: 999rpx;
  background: var(--ld-mini-primary);
  color: #ffffff;
  font-size: var(--ld-font-sm, 24rpx);
  font-weight: 800;
}

.empty {
  display: grid;
  place-items: center;
  min-height: 320rpx;
  color: var(--ld-mini-text-muted);
  font-size: var(--ld-font-md, 28rpx);
}

.bottom {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  justify-content: flex-end;
  padding: 14rpx var(--ld-page-padding, 24rpx) calc(14rpx + env(safe-area-inset-bottom));
  background: #ffffff;
}
</style>
