<template>
  <Layout active-tab="user">
    <view class="page">
      <view class="profile">
        <view class="avatar" />
        <view class="info">
          <text class="name">点点用户</text>
          <text class="tip">会员等级：黄金会员</text>
        </view>
      </view>

      <view class="panel">
        <view class="cell">我的订单</view>
        <view class="cell">优惠券</view>
        <view class="cell">收货地址</view>
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
  box-sizing: border-box;
}

.profile {
  display: flex;
  align-items: center;
  padding: 24rpx;
  border-radius: 16rpx;
  background-color: #ffffff;
}

.avatar {
  width: 96rpx;
  height: 96rpx;
  border-radius: 50%;
  background-color: #ffd7d7;
}

.info {
  margin-left: 20rpx;
}

.name {
  display: block;
  font-size: 30rpx;
  font-weight: 600;
  color: #222222;
}

.tip {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #888888;
}

.panel {
  margin-top: 20rpx;
  background-color: #ffffff;
  border-radius: 14rpx;
  overflow: hidden;
}

.cell {
  padding: 24rpx;
  font-size: 28rpx;
  color: #333333;
  border-bottom: 1rpx solid #f2f2f2;
}

.cell:last-child {
  border-bottom: none;
}
</style>
