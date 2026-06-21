<template>
  <view class="card">
    <text class="title">超值换购，单件最多可省¥4.2元</text>
    <scroll-view class="list" scroll-x>
      <view v-for="item in items" :key="item.id" class="addon">
        <text class="save">{{ item.saveText }}</text>
        <image class="image" :src="item.imageUrl" mode="aspectFill" />
        <PriceText :price="item.price" :original-price="item.originalPrice" size="small" />
        <button class="add" @tap="$emit('add', item.id)">+</button>
      </view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import PriceText from "@/components/app/PriceText.vue";
import type { AddOnProduct } from "@/types/order";

defineProps<{
  items: AddOnProduct[];
}>();

defineEmits<{
  (event: "add", id: string): void;
}>();
</script>

<style scoped>
.card {
  margin: 0 var(--ld-page-padding, 24rpx) var(--ld-page-padding, 24rpx);
  padding: var(--ld-card-padding, 24rpx);
  border-radius: var(--ld-radius-16, 16px);
  background: #ffffff;
}

.title {
  display: block;
  margin-bottom: 16rpx;
  color: var(--ld-mini-text);
  font-size: var(--ld-font-title, 32rpx);
  font-weight: 900;
}

.list {
  white-space: nowrap;
}

.addon {
  position: relative;
  display: inline-block;
  width: 200rpx;
  min-height: 214rpx;
  margin-right: var(--ld-card-gap, 20rpx);
  padding: 32rpx 14rpx 16rpx;
  border-radius: var(--ld-radius-8, 8px);
  background: #fff8f3;
  vertical-align: top;
}

.save {
  position: absolute;
  left: 0;
  top: 0;
  padding: 6rpx 16rpx;
  border-radius: 16rpx 0 16rpx 0;
  background: #ff4c13;
  color: #ffffff;
  font-size: 22rpx;
  font-weight: 800;
}

.image {
  width: 138rpx;
  height: 88rpx;
  margin: 0 auto 14rpx;
  border-radius: var(--ld-radius-8, 8px);
  background: #ffffff;
}

.add {
  position: absolute;
  right: 16rpx;
  bottom: 16rpx;
  width: 42rpx;
  height: 42rpx;
  margin: 0;
  padding: 0;
  border-radius: 50%;
  background: var(--ld-mini-primary);
  color: #ffffff;
  font-size: var(--ld-font-title, 32rpx);
  line-height: 38rpx;
}

.add::after {
  border: 0;
}
</style>
