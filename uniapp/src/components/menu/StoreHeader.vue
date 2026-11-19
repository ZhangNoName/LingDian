<template>
  <view class="store-header">
    <view>
      <text class="name">{{ store.name }}</text>
      <text class="distance">{{ store.distanceText }}</text>
    </view>
    <view class="dine-tag">
      <AppIcon name="location" :size="28" />
      <text>{{ serviceLabel }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import AppIcon from "@/components/app/AppIcon.vue";
import { computed } from "vue";
import type { ServiceMode, StoreSummary } from "@/types/store";

const props = defineProps<{
  store: StoreSummary;
  serviceMode: ServiceMode;
}>();

const serviceLabel = computed(() => {
  if (props.store.businessStatus !== "open") return "暂停营业";
  if (!props.store.supportModes.includes(props.serviceMode)) return "暂停服务";
  return { dineIn: "堂食", takeaway: "自取", delivery: "配送" }[props.serviceMode];
});
</script>

<style scoped>
.store-header {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16rpx var(--ld-page-padding, 24rpx) 20rpx;
  background: #ffffff;
}

.name,
.distance {
  display: block;
}

.name {
  max-width: 500rpx;
  overflow: hidden;
  color: var(--ld-mini-text);
  font-size: 36rpx;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.distance {
  margin-top: 10rpx;
  color: var(--ld-mini-text-muted);
  font-size: 24rpx;
}

.dine-tag {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6rpx;
  min-width: 116rpx;
  height: 60rpx;
  border: 1rpx solid #f0dfc7;
  border-radius: 18rpx;
  background: #fff9ee;
  color: #7a491e;
  text-align: center;
  font-size: 30rpx;
  font-weight: 800;
}

</style>
