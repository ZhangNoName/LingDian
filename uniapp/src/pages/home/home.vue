<template>
  <Layout active-tab="home">
    <view class="page">
      <view class="hero">
        <text class="hero-badge">门店营业中</text>
        <text class="hero-title">零点点餐小程序</text>
        <text class="hero-desc">支持堂食、外带、自提的一体化点餐入口</text>
      </view>

      <view class="section-header">
        <text class="section-title">今日推荐</text>
        <text class="section-link">查看全部</text>
      </view>

      <view class="promo-grid">
        <view class="card card-emphasis">
          <text class="card-title">招牌双人餐</text>
          <text class="card-text">烤鸡腿饭 x2 + 小食 + 饮品</text>
          <text class="card-price">￥58.8</text>
        </view>
        <view class="card">
          <text class="card-title">新人专享券</text>
          <text class="card-text">首单满 30 减 8，自动发放到券包</text>
        </view>
      </view>

      <view class="section-header">
        <text class="section-title">经营状态</text>
      </view>

      <view class="status-panel">
        <view class="status-item">
          <text class="status-label">堂食</text>
          <text class="status-value open">开放中</text>
        </view>
        <view class="status-item">
          <text class="status-label">自提</text>
          <text class="status-value open">约 15 分钟</text>
        </view>
        <view class="status-item">
          <text class="status-label">配送</text>
          <text class="status-value">配送范围配置中</text>
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
  padding: 24rpx 24rpx 0;
  box-sizing: border-box;
}

.hero {
  padding: 32rpx;
  border-radius: 28rpx;
  background: linear-gradient(135deg, #ff6b35, #f97316);
  box-shadow: 0 24rpx 48rpx rgba(255, 107, 53, 0.24);
}

.hero-badge {
  display: inline-flex;
  margin-bottom: 18rpx;
  padding: 8rpx 18rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.18);
  color: #fff5f0;
  font-size: 22rpx;
}

.hero-title {
  display: block;
  font-size: 42rpx;
  font-weight: 700;
  color: #ffffff;
}

.hero-desc {
  display: block;
  margin-top: 12rpx;
  font-size: 24rpx;
  color: #fff2eb;
}

.section-header {
  margin-top: 28rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.section-title {
  font-size: 30rpx;
  font-weight: 700;
  color: var(--ld-text-heading);
}

.section-link {
  font-size: 24rpx;
  color: var(--ld-color-primary);
}

.promo-grid {
  display: grid;
  gap: 20rpx;
  margin-top: 18rpx;
}

.card,
.status-panel {
  margin-top: 24rpx;
  padding: 24rpx;
  border-radius: 24rpx;
  border: 1rpx solid var(--ld-border-default);
  background-color: var(--ld-bg-elevated);
  box-shadow: 0 18rpx 36rpx rgba(123, 63, 38, 0.08);
}

.card {
  margin-top: 0;
}

.card-emphasis {
  background: linear-gradient(180deg, #fff1eb, #ffffff);
}

.card-title {
  display: block;
  font-size: 30rpx;
  font-weight: 700;
  color: var(--ld-text-heading);
}

.card-text {
  display: block;
  margin-top: 10rpx;
  font-size: 26rpx;
  color: var(--ld-text-body);
}

.card-price {
  display: block;
  margin-top: 18rpx;
  font-size: 34rpx;
  font-weight: 700;
  color: var(--ld-color-primary);
}

.status-panel {
  display: grid;
  gap: 18rpx;
}

.status-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.status-label {
  font-size: 26rpx;
  color: var(--ld-text-muted);
}

.status-value {
  font-size: 26rpx;
  color: var(--ld-text-heading);
}

.status-value.open {
  color: var(--ld-color-primary);
  font-weight: 700;
}
</style>
