<template>
  <view class="bar">
    <scroll-view v-if="thumbnails.length" scroll-x class="thumb-scroll">
      <view class="thumbs">
        <image v-for="option in thumbnails" :key="option.optionId" class="thumb" :src="option.imageUrl" mode="aspectFit" />
      </view>
    </scroll-view>
    <view class="actions">
      <AppActionButton size="large" variant="outline" :disabled="disabled" @activate="$emit('buy')">立即购买</AppActionButton>
      <AppActionButton size="large" :disabled="disabled" @activate="$emit('add')">加入购物车</AppActionButton>
    </view>
  </view>
</template>

<script setup lang="ts">
import AppActionButton from "@/components/app/AppActionButton.vue";
import { computed } from "vue";
import type { SelectedOption } from "@/types/menu";

const props = defineProps<{
  selectedOptions: SelectedOption[];
  disabled?: boolean;
}>();

const thumbnails = computed(() => props.selectedOptions.filter((option) => option.imageUrl));

defineEmits<{
  (event: "buy"): void;
  (event: "add"): void;
}>();
</script>

<style scoped>
.bar {
  padding: 16rpx var(--ld-page-padding, 24rpx) calc(16rpx + env(safe-area-inset-bottom));
  background: rgba(255, 255, 255, 0.96);
  border-top: var(--ld-card-border);
}

.thumb-scroll {
  width: 100%;
  margin-bottom: 16rpx;
}

.thumbs {
  display: flex;
  gap: 12rpx;
}

.thumb {
  flex: none;
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
