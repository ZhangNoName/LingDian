<template>
  <Layout active-tab="home">
    <view class="page">
      <view class="hero">
        <text class="hero-title">经典点餐首页</text>
        <text class="hero-desc">爆款套餐、限时优惠一站直达</text>
      </view>

      <view class="card">
        <text class="card-title">今日推荐222</text>
        <text class="card-text">香辣鸡腿堡套餐 + 可乐 + 薯条</text>
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

.hero {
  padding: 28rpx;
  border-radius: 16rpx;
  background: linear-gradient(135deg, #e02020, #ff6b6b);
}

.hero-title {
  display: block;
  font-size: 36rpx;
  font-weight: 600;
  color: #ffffff;
}

.hero-desc {
  display: block;
  margin-top: 12rpx;
  font-size: 24rpx;
  color: #ffe8e8;
}

.card {
  margin-top: 24rpx;
  padding: 24rpx;
  border-radius: 14rpx;
  background-color: #ffffff;
}

.card-title {
  display: block;
  font-size: 30rpx;
  font-weight: 600;
  color: #222222;
}

.card-text {
  display: block;
  margin-top: 10rpx;
  font-size: 26rpx;
  color: #666666;
}
</style>
