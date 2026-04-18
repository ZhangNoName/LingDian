<template>
  <Layout active-tab="user">
    <view class="page">
      <view class="profile-card">
        <text class="name">访客用户</text>
        <text class="meta">手机号授权、会员等级、积分余额将在这里承接</text>
      </view>

      <view class="menu-list">
        <view class="menu-row">
          <text>优惠券</text>
          <text class="hint">3 张可用</text>
        </view>
        <view class="menu-row">
          <text>收货地址</text>
          <text class="hint">管理外带地址</text>
        </view>
        <view class="menu-row">
          <text>发票与售后</text>
          <text class="hint">待接入</text>
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

.profile-card,
.menu-list {
  border-radius: 24rpx;
  border: 1rpx solid var(--ld-border-default);
  background: var(--ld-bg-elevated);
}

.profile-card {
  padding: 28rpx 24rpx;
  background: linear-gradient(180deg, #fff1eb, #ffffff);
}

.name,
.meta {
  display: block;
}

.name {
  font-size: 36rpx;
  font-weight: 700;
  color: var(--ld-text-heading);
}

.meta {
  margin-top: 10rpx;
  font-size: 24rpx;
  color: var(--ld-text-body);
}

.menu-list {
  margin-top: 20rpx;
  padding: 0 24rpx;
}

.menu-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  min-height: 96rpx;
  border-top: 1rpx solid var(--ld-border-default);
  font-size: 28rpx;
  color: var(--ld-text-heading);
}

.menu-row:first-child {
  border-top: 0;
}

.hint {
  color: var(--ld-text-muted);
  font-size: 24rpx;
}
</style>
