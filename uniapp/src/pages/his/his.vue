<template>
  <Layout active-tab="his">
    <view class="page">
      <text class="title">订单记录</text>

      <view class="order-card">
        <text class="order-no">订单号 LD202604180001</text>
        <text class="order-meta">堂食 · 已完成 · 2 件商品</text>
        <view class="order-footer">
          <text class="amount">￥58.8</text>
          <text class="status">再来一单</text>
        </view>
      </view>

      <view class="order-card">
        <text class="order-no">订单号 LD202604170021</text>
        <text class="order-meta">自提 · 待评价 · 1 件商品</text>
        <view class="order-footer">
          <text class="amount">￥29.9</text>
          <text class="status muted">查看详情</text>
        </view>
      </view>
    </view>
  </Layout>
</template>

<script setup lang="ts">
import Layout from "../../layout/layout.vue";
</script>

<style scoped>
.page {
  padding: 24rpx;
}

.title {
  display: block;
  margin-bottom: 18rpx;
  font-size: 38rpx;
  font-weight: 700;
  color: var(--ld-text-heading);
}

.order-card {
  margin-bottom: 18rpx;
  padding: 24rpx;
  border-radius: 24rpx;
  border: 1rpx solid var(--ld-border-default);
  background: var(--ld-bg-elevated);
}

.order-no,
.order-meta,
.amount,
.status {
  display: block;
}

.order-no {
  font-size: 28rpx;
  color: var(--ld-text-heading);
}

.order-meta {
  margin-top: 10rpx;
  font-size: 24rpx;
  color: var(--ld-text-muted);
}

.order-footer {
  margin-top: 18rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.amount {
  font-size: 32rpx;
  font-weight: 700;
  color: var(--ld-color-primary);
}

.status {
  font-size: 24rpx;
  color: var(--ld-color-primary);
}

.status.muted {
  color: var(--ld-text-body);
}
</style>
