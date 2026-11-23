<template>
  <view class="hero" :class="{ 'hero-with-stack': product.comboImages.length > 0 }">
    <ProductThumbnail :src="product.imageUrl" hero />
    <view v-if="product.comboImages.length" class="stack">
      <image v-for="image in product.comboImages" :key="image" class="stack-image" :src="image" mode="aspectFit" />
    </view>
  </view>
</template>

<script setup lang="ts">
import ProductThumbnail from "@/components/app/ProductThumbnail.vue";
import type { ProductDetail } from "@/types/menu";

defineProps<{
  product: ProductDetail;
}>();
</script>

<style scoped>
.hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  padding: 0 var(--ld-page-padding, 24rpx);
}

.hero-with-stack {
  grid-template-columns: minmax(0, 1fr) 164rpx;
  gap: 12rpx;
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
