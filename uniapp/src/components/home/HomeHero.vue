<template>
  <view class="hero" role="img" :aria-label="imageFailed ? '零食坊品牌图片暂无法显示' : '零食坊品牌形象'">
    <image v-if="!imageFailed" class="hero-image" src="/static/home-brand-hero.jpg" mode="aspectFill" @error="markImageFailed" />
    <view v-else class="hero-fallback">
      <image class="fallback-logo" src="/static/logo-xsf-red-yellow.png" mode="aspectFit" aria-label="零食坊品牌标志" />
      <text class="fallback-copy">品牌图片暂无法显示</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";

const imageFailed = ref(false);

function markImageFailed() {
  imageFailed.value = true;
}
</script>

<style scoped>
.hero {
  height: 240rpx;
  overflow: hidden;
  border-radius: 24rpx;
  background: #fff1dc;
}

.hero-image {
  display: block;
  width: 100%;
  height: 240rpx;
}

.hero-fallback {
  display: grid;
  height: 240rpx;
  align-content: center;
  justify-items: center;
  gap: 10rpx;
  background: #fff1dc;
}

.fallback-logo {
  width: 100rpx;
  height: 100rpx;
}

.fallback-copy {
  color: #8a3b18;
  font-size: var(--ld-font-xs, 22rpx);
}
</style>
