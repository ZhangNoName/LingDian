<template>
  <view class="page">
    <AppNavBar title="订单详情" show-back @back="goBack" />

    <view v-if="detail" class="content">
      <view class="status-block">
        <text class="status-title">{{ statusTitle }}</text>
        <view class="reward">本单获得{{ detail.rewardPoints }}积分 立即兑换 ›</view>
      </view>

      <view class="promo">
        <SkeletonBox class="promo-visual" radius="lg" />
        <view class="promo-copy">
          <text class="promo-title">免费送</text>
          <text class="promo-subtitle">礼卡福利与会员专享</text>
        </view>
      </view>

      <OrderDetailGoodsCard :detail="detail" />
      <OrderInfoCard :rows="detail.infoRows" />
    </view>

    <view v-else class="empty">未找到订单详情</view>
    <view v-if="detail?.status === 'finished'" class="bottom">
      <button class="again" @tap="goMenu">再来一单</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import AppNavBar from "@/components/app/AppNavBar.vue";
import SkeletonBox from "@/components/app/SkeletonBox.vue";
import OrderDetailGoodsCard from "@/components/orders/OrderDetailGoodsCard.vue";
import OrderInfoCard from "@/components/orders/OrderInfoCard.vue";
import { orderDetails } from "@/data/mock";
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
    refunding: "订单退款中",
    refunded: "订单已退款",
  };
  return labels[detail.value.status];
});

onLoad((query) => {
  const id = typeof query?.id === "string" ? query.id : "LD202606150001";
  detail.value = orderDetails[id] ?? orderDetails.LD202606150001;
});

function goBack() {
  uni.navigateBack();
}

function goMenu() {
  uni.redirectTo({ url: "/pages/order/order" });
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  padding-bottom: 128rpx;
  background: #f3f3f3;
}

.content {
  padding-bottom: 24rpx;
}

.status-block {
  position: relative;
  padding: 28rpx 48rpx 24rpx;
}

.status-title {
  display: block;
  color: var(--ld-mini-text);
  font-size: 42rpx;
  font-weight: 900;
}

.reward {
  display: inline-flex;
  margin-top: 18rpx;
  padding: 10rpx 20rpx;
  border-radius: 999rpx;
  background: var(--ld-mini-primary);
  color: #ffffff;
  font-size: 26rpx;
  font-weight: 800;
}

.promo {
  position: relative;
  margin: 16rpx 24rpx 24rpx;
  height: 210rpx;
  overflow: hidden;
  border-radius: 24rpx;
  background: #fff4df;
}

.promo-visual {
  width: 100%;
  height: 100%;
}

.promo-copy {
  position: absolute;
  left: 46rpx;
  top: 44rpx;
  color: #8f3700;
}

.promo-title,
.promo-subtitle {
  display: block;
}

.promo-title {
  font-size: 58rpx;
  font-weight: 900;
}

.promo-subtitle {
  margin-top: 12rpx;
  font-size: 24rpx;
}

.empty {
  display: grid;
  place-items: center;
  min-height: 420rpx;
  color: var(--ld-mini-text-muted);
  font-size: 30rpx;
}

.bottom {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  justify-content: flex-end;
  padding: 18rpx 24rpx calc(18rpx + env(safe-area-inset-bottom));
  background: #ffffff;
}

.again {
  width: 176rpx;
  height: 72rpx;
  margin: 0;
  border: 1rpx solid #dddddd;
  border-radius: 12rpx;
  background: #ffffff;
  color: #555555;
  font-size: 30rpx;
  line-height: 72rpx;
}

.again::after {
  border: 0;
}
</style>
