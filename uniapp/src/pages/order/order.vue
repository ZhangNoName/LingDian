<template>
  <Layout active-tab="order">
    <view class="page">
      <view class="header">
        <text class="title">点餐</text>
        <view class="history-link" @tap="goHistory">历史订单</view>
      </view>

      <view class="category-row">
        <view class="category category--active">人气推荐</view>
        <view class="category">超值套餐</view>
        <view class="category">小食饮品</view>
      </view>

      <view class="goods-list">
        <view class="goods-card">
          <view class="goods-main">
            <text class="goods-name">经典鸡腿堡套餐</text>
            <text class="goods-desc">鸡腿堡 + 中薯 + 可乐</text>
            <text class="goods-price">￥28.90</text>
          </view>
          <view class="add-btn">加入购物车</view>
        </view>

        <view class="goods-card">
          <view class="goods-main">
            <text class="goods-name">香辣鸡翅（2只）</text>
            <text class="goods-desc">外酥里嫩，现炸出餐</text>
            <text class="goods-price">￥12.90</text>
          </view>
          <view class="add-btn">加入购物车</view>
        </view>

        <view class="goods-card">
          <view class="goods-main">
            <text class="goods-name">蜜汁鸡排</text>
            <text class="goods-desc">甜辣风味，口感扎实</text>
            <text class="goods-price">￥15.00</text>
          </view>
          <view class="add-btn">加入购物车</view>
        </view>
      </view>
    </view>
  </Layout>
</template>

<script setup lang="ts">
import Layout from "../../layout/layout.vue";

function goHistory() {
  uni.navigateTo({ url: "/pages/his/his" });
}
</script>

<style scoped>
.page {
  padding: 24rpx;
  box-sizing: border-box;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8rpx;
}

.title {
  font-size: 38rpx;
  font-weight: 700;
  color: #222222;
}

.history-link {
  padding: 8rpx 20rpx;
  border-radius: 999rpx;
  font-size: 22rpx;
  color: #e02020;
  background-color: #ffecec;
}

.category-row {
  margin-top: 22rpx;
  display: flex;
  gap: 12rpx;
}

.category {
  padding: 10rpx 18rpx;
  border-radius: 999rpx;
  font-size: 22rpx;
  color: #777777;
  background-color: #f1f1f1;
}

.category--active {
  color: #ffffff;
  background-color: #e02020;
}

.goods-list {
  margin-top: 18rpx;
}

.goods-card {
  margin-bottom: 16rpx;
  padding: 22rpx;
  border-radius: 14rpx;
  background-color: #ffffff;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
}

.goods-main {
  display: flex;
  flex-direction: column;
}

.goods-name {
  font-size: 30rpx;
  font-weight: 600;
  color: #222222;
}

.goods-desc {
  display: block;
  margin-top: 10rpx;
  font-size: 24rpx;
  color: #7f7f7f;
}

.goods-price {
  display: block;
  margin-top: 12rpx;
  font-size: 30rpx;
  font-weight: 700;
  color: #e02020;
}

.add-btn {
  padding: 8rpx 22rpx;
  border-radius: 999rpx;
  font-size: 22rpx;
  color: #ffffff;
  background-color: #e02020;
}
</style>
