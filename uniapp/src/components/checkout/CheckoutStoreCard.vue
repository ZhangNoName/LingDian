<template>
  <view class="card">
    <view class="title-row">
      <text class="title">{{ store.name }}</text>
    </view>
    <text v-if="store.businessText !== '营业时间未记录'" class="business-text">{{ store.businessText }}</text>
    <view v-if="modes.length" class="service-options">
      <ServiceModeCards :modes="modes" :selected="serviceMode" @select="$emit('select-mode', $event)" />
    </view>
    <text v-else class="mode-unavailable">当前门店暂不支持下单</text>
    <view v-if="pickupTimeText" class="pickup">
      <text>{{ serviceMode === "delivery" ? "配送时间" : serviceMode === "dineIn" ? "就餐时间" : "取餐时间" }}</text>
      <text class="pickup-time">{{ serviceMode === "delivery" ? "时间未提供" : pickupTimeText }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue";
import ServiceModeCards from "@/components/app/ServiceModeCards.vue";
import { homeServiceModes } from "@/data/home-service-modes";
import type { ServiceMode, StoreSummary } from "@/types/store";

const props = defineProps<{
  store: StoreSummary;
  pickupTimeText: string;
  serviceMode: ServiceMode;
}>();

const modes = computed(() => homeServiceModes.filter((mode) => props.store.supportModes.includes(mode.key)));

defineEmits<{
  (event: "select-mode", value: ServiceMode): void;
}>();
</script>

<style scoped>
.card {
  margin: 0 var(--ld-page-padding, 24rpx) var(--ld-page-padding, 24rpx);
  padding: var(--ld-card-padding, 24rpx);
  border-radius: var(--ld-radius-16, 16px);
  background: #ffffff;
  box-shadow: var(--ld-mini-shadow-float);
}

.title-row,
.pickup {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.title {
  color: var(--ld-mini-text);
  font-size: var(--ld-font-title, 32rpx);
  font-weight: 750;
  overflow-wrap: anywhere;
}

.business-text {
  display: block;
  margin: 10rpx 0 0;
  color: var(--ld-mini-text-muted);
  font-size: var(--ld-font-base);
  line-height: 1.45;
}

.service-options { margin-top: 18rpx; }

.mode-unavailable {
  color: var(--ld-mini-text-muted);
  font-size: var(--ld-font-sm, 24rpx);
}

.pickup {
  margin-top: 22rpx;
  padding-top: 20rpx;
  border-top: 1rpx solid #f1f1f1;
  color: var(--ld-mini-text);
  font-size: var(--ld-font-base, 26rpx);
}

.pickup-time {
  color: var(--ld-mini-primary);
  font-weight: 800;
}
</style>
