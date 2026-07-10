<template>
  <view class="hero">
    <image class="main" :src="product.imageUrl" mode="aspectFill" />
    <view class="stack">
      <image v-for="image in product.comboImages" :key="image" class="stack-image" :src="image" mode="aspectFill" />
    </view>
  </view>
</template>

<script setup lang="ts">
import type { ProductDetail } from "@/types/menu";

defineProps<{
  product: ProductDetail;
}>();
</script>

<style scoped>
.hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 164rpx;
  gap: 12rpx;
  padding: 0 var(--ld-page-padding, 24rpx);
}

.main {
  width: 100%;
  height: 352rpx;
  align-self: end;
  border-radius: 28rpx;
  background: #ffffff;
}

.stack {
  display: grid;
  gap: 12rpx;
}

.stack-image {
  width: 164rpx;
  height: 108rpx;
  border-radius: 16rpx;
  background: #ffffff;
}
</style>
