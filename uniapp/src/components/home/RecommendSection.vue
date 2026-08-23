<template>
  <view class="recommend">
    <view class="section-title">
      <text class="section-heading">堡藏推荐</text>
      <text class="tag">福利满满</text>
    </view>
    <view v-if="products.length" class="grid">
      <view
        v-for="product in products"
        :key="product.id"
        class="card"
        role="button"
        tabindex="0"
        :aria-label="`查看${product.name}`"
        @keydown.enter="$emit('select', product.id)"
        @tap="$emit('select', product.id)"
      >
        <view class="image-shell">
          <image v-if="!failedImages.has(product.id)" class="image" :src="product.imageUrl" mode="aspectFill" @error="markImageFailed(product.id)" />
          <view v-else class="image-placeholder">
            <text class="placeholder-icon">餐</text>
            <text class="placeholder-copy">图片待更新</text>
          </view>
        </view>
        <text class="name">{{ product.name }}</text>
        <PriceText :price="product.price" :original-price="product.originalPrice" suffix="一口价" size="small" />
        <button class="add" role="button" tabindex="0" :aria-label="`选择${product.name}`" @keydown.enter.stop="$emit('select', product.id)" @tap.stop="$emit('select', product.id)">
          <PlusIcon class="add-icon" aria-hidden="true" />
        </button>
      </view>
    </view>
    <view v-else class="empty">
      <text class="empty-title">推荐餐品正在准备中</text>
      <text class="empty-copy">完整菜单里还有更多选择</text>
      <button class="browse" role="button" tabindex="0" @keydown.enter="$emit('browse')" @tap="$emit('browse')">去菜单看看</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { PlusIcon } from "@lingdian/icons/miniapp";
import PriceText from "@/components/app/PriceText.vue";
import type { ProductSummary } from "@/types/menu";

defineProps<{
  products: ProductSummary[];
}>();

defineEmits<{
  (event: "select", productId: string): void;
  (event: "browse"): void;
}>();

const failedImages = ref(new Set<string>());

function markImageFailed(productId: string) {
  failedImages.value.add(productId);
}
</script>

<style scoped>
.recommend {
  padding: var(--ld-card-padding, 24rpx);
  border-radius: var(--ld-radius-16, 16px);
  background: #ffffff;
  box-shadow: var(--ld-mini-shadow-float);
}

.section-title {
  display: flex;
  align-items: center;
  gap: 14rpx;
  margin-bottom: 18rpx;
}

.section-heading {
  color: var(--ld-mini-text);
  font-size: var(--ld-font-title, 32rpx);
  font-weight: 900;
}

.tag {
  padding: 4rpx 14rpx;
  border-radius: 999rpx;
  background: #ff9700;
  color: #ffffff;
  font-size: var(--ld-font-xs, 22rpx);
  font-weight: 800;
}

.grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--ld-card-gap, 20rpx);
}

.empty {
  display: grid;
  justify-items: center;
  min-height: 164rpx;
  padding: 20rpx 16rpx 8rpx;
  text-align: center;
}

.empty-title {
  color: var(--ld-mini-text);
  font-size: 28rpx;
  font-weight: 800;
}

.empty-copy {
  margin-top: 10rpx;
  color: #666666;
  font-size: 24rpx;
}

.browse {
  height: 64rpx;
  margin-top: 16rpx;
  padding: 0 28rpx;
  border-radius: 999rpx;
  background: var(--ld-mini-primary);
  color: #ffffff;
  font-size: 24rpx;
  font-weight: 800;
  line-height: 64rpx;
}

.browse::after {
  border: 0;
}

.card {
  position: relative;
  display: grid;
  grid-template-rows: 148rpx minmax(58rpx, auto) auto 48rpx;
  min-height: 300rpx;
  padding: 16rpx;
  border-radius: var(--ld-radius-8, 8px);
  background: #fffaf0;
}

.image-shell {
  overflow: hidden;
  border-radius: var(--ld-radius-8, 8px);
  background: #ffffff;
}

.image {
  width: 100%;
  height: 148rpx;
  background: #ffffff;
}

.image-placeholder {
  display: grid;
  place-items: center;
  width: 100%;
  height: 148rpx;
  align-content: center;
  gap: 6rpx;
  border-radius: var(--ld-radius-8, 8px);
  background: linear-gradient(145deg, #fff7e9, #f8efe1);
  color: #b77935;
}

.placeholder-icon {
  display: block;
  width: 48rpx;
  height: 48rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.78);
  text-align: center;
  font-size: 24rpx;
  font-weight: 900;
  line-height: 48rpx;
}

.placeholder-copy {
  color: #9b7650;
  font-size: 20rpx;
  line-height: 1.2;
}

.name {
  display: block;
  display: -webkit-box;
  overflow: hidden;
  margin: 12rpx 0 6rpx;
  color: var(--ld-mini-text);
  font-size: var(--ld-font-sm, 24rpx);
  font-weight: 700;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.add {
  position: absolute;
  right: 16rpx;
  bottom: 16rpx;
  display: grid;
  place-items: center;
  width: 48rpx;
  height: 48rpx;
  margin: 0;
  padding: 0;
  border-radius: 50%;
  background: var(--ld-mini-primary);
  color: #ffffff;
}

.add-icon {
  display: block;
  width: 28rpx;
  height: 28rpx;
  font-size: 28rpx;
  font-weight: 900;
  line-height: 28rpx;
}

.add::after {
  border: 0;
}
</style>
