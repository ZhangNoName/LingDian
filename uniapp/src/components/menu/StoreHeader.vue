<template>
  <view class="store-header">
    <view>
      <text class="name">{{ store.name }}</text>
      <text class="distance">{{ store.distanceText }}</text>
    </view>
    <view class="dine-tag">
      <StoreLocationIcon class="tag-icon" aria-hidden="true" />
      <text>{{ serviceLabel }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { StoreLocationIcon } from "@lingdian/icons/miniapp";
import { computed } from "vue";
import type { StoreSummary } from "@/types/store";

const props = defineProps<{
  store: StoreSummary;
}>();

const serviceLabel = computed(() => {
  if (props.store.businessStatus !== "open") return "暂停营业";
  if (props.store.supportModes.includes("dineIn")) return "堂食";
  if (props.store.supportModes.includes("takeaway")) return "自取";
  if (props.store.supportModes.includes("delivery")) return "配送";
  return "暂停服务";
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

.tag-icon {
  display: block;
  width: 28rpx;
  height: 28rpx;
  font-size: 28rpx;
  line-height: 28rpx;
}
</style>
