<template>
  <Layout active-tab="order">
    <view class="page">
      <view class="page-header">
        <text class="title">点餐</text>
        <text class="subtitle">分类、商品、购物车三段式结构预留完成</text>
      </view>

      <view class="panel">
        <text class="panel-title">推荐分类</text>
        <view class="chip-row">
          <text class="chip active">招牌主食</text>
          <text class="chip">热销套餐</text>
          <text class="chip">小吃饮品</text>
        </view>
      </view>

      <view class="panel">
        <text class="panel-title">示例商品</text>
        <view class="menu-item">
          <view>
            <text class="item-title">炙烤鸡腿饭</text>
            <text class="item-desc">去骨鸡腿 + 溏心蛋 + 时蔬</text>
          </view>
          <text class="item-price">￥29.9</text>
        </view>
        <view class="menu-item">
          <view>
            <text class="item-title">薯条拼盘</text>
            <text class="item-desc">支持加购推荐和套餐联动</text>
          </view>
          <text class="item-price">￥12</text>
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

.page-header {
  margin-bottom: 24rpx;
}

.title {
  display: block;
  font-size: 38rpx;
  font-weight: 700;
  color: var(--ld-text-heading);
}

.subtitle {
  display: block;
  margin-top: 10rpx;
  font-size: 24rpx;
  color: var(--ld-text-muted);
}

.panel {
  margin-bottom: 20rpx;
  padding: 24rpx;
  border-radius: 24rpx;
  border: 1rpx solid var(--ld-border-default);
  background: var(--ld-bg-elevated);
}

.panel-title {
  display: block;
  margin-bottom: 18rpx;
  font-size: 28rpx;
  font-weight: 700;
  color: var(--ld-text-heading);
}

.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 14rpx;
}

.chip {
  padding: 12rpx 20rpx;
  border-radius: 999rpx;
  background: var(--ld-bg-muted);
  color: var(--ld-text-body);
  font-size: 24rpx;
}

.chip.active {
  background: var(--ld-accent-bg);
  color: var(--ld-color-primary);
}

.menu-item {
  display: flex;
  justify-content: space-between;
  gap: 18rpx;
  padding: 20rpx 0;
  border-top: 1rpx solid var(--ld-border-default);
}

.menu-item:first-of-type {
  border-top: 0;
  padding-top: 0;
}

.item-title {
  display: block;
  font-size: 28rpx;
  color: var(--ld-text-heading);
}

.item-desc {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: var(--ld-text-muted);
}

.item-price {
  font-size: 30rpx;
  font-weight: 700;
  color: var(--ld-color-primary);
}
</style>
