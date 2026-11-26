<template>
  <Layout :show-tab-bar="false">
    <template #header>
      <AppNavBar title="订单详情" show-back @back="goBack" />
    </template>

    <view class="detail-content" :class="{ 'detail-with-action': canReorder }">
      <view v-if="loadError" class="empty">
        <text>{{ loadError }}</text>
        <AppActionButton size="small" variant="outline" @activate="loadDetail">重试</AppActionButton>
      </view>
      <view v-else-if="detail" class="content">
        <view class="status-block">
          <view v-if="detail.pickupCardCode" class="pickup-card" :class="'pickup-' + detail.status">
            <view class="pickup-heading">
              <text class="pickup-label">{{ detail.pickupCodeLabel }}</text>
              <text class="pickup-status status-title" role="status">{{ statusTitle }}</text>
            </view>
            <text class="pickup-code" :class="{ 'pickup-code-long': detail.pickupCardCode.length > 11 }">{{ detail.pickupCardCode }}</text>
            <text v-if="statusHint" class="pickup-hint">{{ statusHint }}</text>
          </view>
          <view v-else>
            <text class="status-title" role="status">{{ statusTitle }}</text>
            <text v-if="statusHint" class="status-hint">{{ statusHint }}</text>
          </view>
          <view v-if="detail.rewardPoints != null" class="reward">本单获得{{ detail.rewardPoints }}积分</view>
          <view v-if="pickupSubscription" class="pickup-subscription">
            <text v-if="pickupSubscription.subscribed" role="status" class="status-hint">已订阅取餐提醒</text>
            <AppActionButton v-else variant="outline" size="small" :loading="subscribing" @activate="subscribePickup">
              订阅取餐提醒
            </AppActionButton>
          </view>
        </view>

        <OrderDetailGoodsCard :detail="detail" />
        <OrderInfoCard :rows="detail.infoRows" />
      </view>

      <view v-else class="empty">正在加载订单…</view>
    </view>
    <template #footer>
      <view v-if="canReorder" class="bottom">
        <AppActionButton variant="outline" @activate="goMenu">再来一单</AppActionButton>
      </view>
    </template>
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
import { customerAuth } from "@/services/auth";
import { navigateBackOrRedirect, requireCustomerAuth } from "@/services/auth-navigation";
import type { OrderDetail } from "@/types/order";
import { miniProgramAuthProvider } from "@/config/platform";
import type { OrderPickupSubscription } from "@lingdian/contracts";
import { getPickupSubscription, subscribeToPickup } from "@/services/pickup-notification";

const detail = ref<OrderDetail | null>(null);
const pickupSubscription = ref<OrderPickupSubscription | null>(null);
const subscribing = ref(false);
const statusHint = computed(() => {
  if (detail.value?.pickupCardCode && detail.value.status === "ready" && detail.value.serviceMode !== "delivery") {
    return "请向店员出示取餐码。";
  }
  if (detail.value?.status !== "pendingPay") return "";
  return detail.value.paymentChannel === "CASH"
    ? "请线下付款。门店确认收款后会更新订单状态。"
    : "请联系门店核对付款状态。";
});

const statusTitle = computed(() => {
  if (!detail.value) return "";
  const labels: Record<OrderDetail["status"], string> = {
    pendingPay: detail.value.paymentChannel === "CASH" ? "待线下付款" : "订单待支付",
    paid: "订单已支付",
    making: "订单制作中",
    ready: detail.value.serviceMode === "delivery" ? "订单待配送" : "订单待取餐",
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
let fromCheckout = false;
const loadError = ref("");
const canReorder = computed(() => !loadError.value && detail.value?.status === "finished");
const loading = ref(false);
let sequence = 0;
let detailSession: number | undefined;

onLoad((query) => {
  orderId.value = typeof query?.id === "string" ? query.id : "";
  fromCheckout = query?.from === "checkout";
});
onShow(() => { void loadDetail(); });
onHide(() => { sequence++; loading.value = false; });

async function loadDetail() {
  if (loading.value) return;
  if (!customerAuth.isSignedIn() || detailSession !== customerAuth.getSessionVersion()) {
    detail.value = null;
    pickupSubscription.value = null;
  }
  const current = ++sequence;
  loading.value = true;
  loadError.value = "";
  try {
    if (!orderId.value) throw new Error("缺少订单编号");
    if (!(await requireCustomerAuth()) || current !== sequence) return;
    const session = customerAuth.getSessionVersion();
    const result = await fetchOrderDetail(orderId.value);
    if (current !== sequence || session !== customerAuth.getSessionVersion()) return;
    detail.value = result;
    detailSession = session;
    if (miniProgramAuthProvider() === "WECHAT" && result.serviceMode !== "delivery" &&
        result.orderSource === "MINIAPP" && result.pickupCardCode &&
        ["pendingPay", "paid", "making", "ready"].includes(result.status)) {
      void getPickupSubscription(result.id).then(subscription => {
        if (current === sequence && session === customerAuth.getSessionVersion() && !pickupSubscription.value?.subscribed) {
          pickupSubscription.value = subscription;
        }
      }).catch(() => undefined);
    } else {
      pickupSubscription.value = null;
    }
  } catch (error) {
    if (current === sequence) {
      if (detailSession !== customerAuth.getSessionVersion()) detail.value = null;
      const message = error instanceof Error ? error.message : "订单加载失败";
      if (detail.value) uni.showToast({ title: message, icon: "none" });
      else loadError.value = message;
    }
  } finally {
    if (current === sequence) loading.value = false;
  }
}

async function subscribePickup() {
  const order = detail.value;
  const subscription = pickupSubscription.value;
  if (!order || !subscription || subscription.subscribed || subscribing.value) return;
  subscribing.value = true;
  try {
    const result = await subscribeToPickup(order.id, subscription.template_id);
    if (result && detail.value?.id === order.id && detailSession === customerAuth.getSessionVersion()) {
      pickupSubscription.value = result;
    }
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : "取餐提醒订阅失败，请重试", icon: "none" });
  } finally {
    subscribing.value = false;
  }
}

function goBack() {
  if (fromCheckout) uni.reLaunch({ url: "/pages/his/his" });
  else navigateBackOrRedirect("/pages/his/his");
}

function goMenu() {
  uni.redirectTo({ url: "/pages/order/order" });
}
</script>

<style scoped>
.detail-content {
  padding-top: var(--ld-page-padding, 24rpx);
  padding-bottom: var(--ld-page-bottom-safe);
}

.detail-with-action {
  padding-bottom: 12rpx;
}

.status-block {
  margin: 0 var(--ld-page-padding);
}

.status-title {
  display: block;
  color: var(--ld-mini-text);
  font-size: var(--ld-font-title-lg, 36rpx);
  font-weight: 750;
}

.status-hint {
  display: block;
  margin-top: 10rpx;
  color: var(--ld-mini-text-muted);
  font-size: var(--ld-font-base);
  line-height: 1.5;
}

.pickup-subscription {
  margin-top: 16rpx;
}

.pickup-card {
  --pickup-ink: var(--ld-mini-warning-text);
  --pickup-chip: #ffe5ad;
  --pickup-chip-ink: var(--ld-mini-warning-text);
  padding: 24rpx 28rpx 26rpx;
  border-radius: var(--ld-radius-16);
  background: linear-gradient(125deg, #fff6e5, #ffe5b7);
  color: var(--pickup-ink);
}

.pickup-ready {
  --pickup-ink: #ffffff;
  --pickup-chip: #ffe2a3;
  --pickup-chip-ink: #662308;
  background: linear-gradient(125deg, #ab1425, #c91a2c);
}

.pickup-finished {
  --pickup-ink: var(--ld-mini-success-text);
  --pickup-chip: #c1e9d4;
  --pickup-chip-ink: var(--ld-mini-success-text);
  background: linear-gradient(125deg, #eff9f3, #d8f1e4);
}

.pickup-heading {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
}

.pickup-label {
  font-size: var(--ld-font-md);
  font-weight: 700;
}

.pickup-status {
  padding: 6rpx 14rpx;
  border-radius: 999rpx;
  background: var(--pickup-chip);
  color: var(--pickup-chip-ink);
  font-size: var(--ld-font-sm);
  font-weight: 700;
}

.pickup-code {
  display: block;
  margin-top: 14rpx;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 82rpx;
  font-weight: 800;
  letter-spacing: 3rpx;
  line-height: 1.2;
  text-align: center;
  overflow-wrap: anywhere;
  font-variant-numeric: tabular-nums;
}

.pickup-code-long {
  font-size: 54rpx;
  letter-spacing: 0;
}

.pickup-hint {
  display: block;
  margin-top: 12rpx;
  font-size: var(--ld-font-base);
  line-height: 1.4;
  text-align: center;
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
  display: flex;
  justify-content: flex-end;
  padding: 14rpx var(--ld-page-padding, 24rpx) calc(14rpx + env(safe-area-inset-bottom));
  background: #ffffff;
  border-top: var(--ld-card-border);
}
</style>
