<template>
  <view class="bar">
    <view v-if="thumbnails.length" class="thumbs">
      <image v-for="option in thumbnails" :key="option.optionId" class="thumb" :src="option.imageUrl" mode="aspectFill" />
    </view>
    <view class="actions">
      <AppActionButton size="large" variant="outline" @activate="$emit('buy')">立即购买</AppActionButton>
      <AppActionButton size="large" @activate="$emit('add')">加入购物车</AppActionButton>
    </view>
  </view>
</template>

<script setup lang="ts">
import AppActionButton from "@/components/app/AppActionButton.vue";
import { computed } from "vue";
import type { SelectedOption } from "@/types/menu";

const props = defineProps<{
  selectedOptions: SelectedOption[];
}>();

const thumbnails = computed(() => props.selectedOptions.filter((option) => option.imageUrl));

defineEmits<{
  (event: "buy"): void;
  (event: "add"): void;
}>();
</script>

<style scoped>
.bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 20;
  padding: 16rpx var(--ld-page-padding, 24rpx) calc(16rpx + env(safe-area-inset-bottom));
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 -20rpx 48rpx rgba(0, 0, 0, 0.06);
}

.thumbs {
  display: flex;
  gap: 12rpx;
  min-height: 76rpx;
  margin-bottom: 16rpx;
}

.thumb {
  width: 76rpx;
  height: 76rpx;
  border: 1rpx solid #b9934b;
  border-radius: 14rpx;
}


.actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--ld-card-gap, 20rpx);
}
</style>
