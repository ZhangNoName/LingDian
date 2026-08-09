<template>
  <view class="card" role="button" tabindex="0" @tap="$emit('manage')">
    <view v-if="address" class="address-content">
      <view class="title-row">
        <text class="title">配送至</text>
        <text class="manage">更换 ›</text>
      </view>
      <text class="address">{{ fullAddress }}</text>
      <text class="recipient">{{ address.recipientName }}　{{ address.phoneNumber }}</text>
    </view>
    <view v-else class="empty-content">
      <view>
        <text class="title">请选择收货地址</text>
        <text class="hint">配送订单需要一个有效地址</text>
      </view>
      <text class="manage">去添加 ›</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import type { UserAddress } from "@lingdian/contracts";
import { computed } from "vue";

const props = defineProps<{
  address?: UserAddress;
}>();

defineEmits<{
  (event: "manage"): void;
}>();

const fullAddress = computed(() => props.address
  ? `${props.address.provinceName}${props.address.cityName}${props.address.countyName}${props.address.streetName}${props.address.detailInfo}`
  : "");
</script>

<style scoped>
.card {
  margin: 0 var(--ld-page-padding, 24rpx) var(--ld-page-padding, 24rpx);
  padding: var(--ld-card-padding, 24rpx);
  border-radius: var(--ld-radius-16, 16px);
  background: #ffffff;
  box-shadow: var(--ld-mini-shadow-card);
}

.title-row,
.empty-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
}

.title,
.hint,
.address,
.recipient {
  display: block;
}

.title {
  color: var(--ld-mini-text);
  font-size: 28rpx;
  font-weight: 900;
}

.manage {
  color: var(--ld-mini-primary);
  font-size: 24rpx;
  font-weight: 800;
}

.address {
  margin-top: 18rpx;
  color: var(--ld-mini-text);
  font-size: 30rpx;
  font-weight: 900;
  line-height: 1.45;
}

.recipient,
.hint {
  margin-top: 10rpx;
  color: #666666;
  font-size: 24rpx;
}
</style>
