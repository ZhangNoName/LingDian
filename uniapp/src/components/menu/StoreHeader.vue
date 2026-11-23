<template>
  <view class="store-header">
    <view class="store-info">
      <text class="name">{{ store.name }}</text>
      <text v-if="store.businessText && store.businessText !== '营业时间未记录'" class="hours">{{ store.businessText }}</text>
    </view>
    <view class="service-tag" :class="{ 'paused': servicePaused }">
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

const servicePaused = computed(() => props.store.businessStatus !== "open" || !props.store.supportModes.includes(props.serviceMode));

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
  gap: 16rpx;
  padding: 16rpx var(--ld-page-padding, 24rpx) 20rpx;
  background: var(--ld-mini-surface);
}

.store-info { min-width: 0; }

.name,
.hours {
  display: block;
}

.name {
  overflow: hidden;
  color: var(--ld-mini-text);
  font-size: 36rpx;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hours {
  margin-top: 10rpx;
  color: var(--ld-mini-text-muted);
  font-size: 24rpx;
}

.service-tag {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  gap: 6rpx;
  min-height: 58rpx;
  padding: 0 14rpx;
  border-radius: var(--ld-radius-8);
  background: var(--ld-mini-warning-bg);
  color: var(--ld-mini-warning-text);
  text-align: center;
  font-size: var(--ld-font-base);
  font-weight: 800;
}
.service-tag.paused {
  background: var(--ld-mini-neutral-bg);
  color: var(--ld-mini-neutral-text);
}

</style>
