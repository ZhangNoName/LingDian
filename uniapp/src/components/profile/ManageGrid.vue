<template>
  <view class="manage">
    <view class="grid">
      <view v-for="(entry, index) in entries" :key="entry.key" class="entry">
        <view class="icon-shell">
          <ManageOrdersIcon v-if="entry.key === 'orders'" class="icon" :stroke-width="2.2" />
          <ManageAddressIcon v-else-if="entry.key === 'address'" class="icon" :stroke-width="2.2" />
          <ManageFavoritesIcon v-else-if="entry.key === 'favorites'" class="icon" :stroke-width="2.2" />
          <ManageTransactionsIcon v-else-if="entry.key === 'transactions'" class="icon" :stroke-width="2.2" />
          <ManageFallbackIcon v-else class="icon" :stroke-width="2.2" />
        </view>
        <text class="entry-label">{{ entry.label }}</text>
        <view v-if="index < entries.length - 1" class="separator" />
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import {
  ManageAddressIcon,
  ManageFallbackIcon,
  ManageFavoritesIcon,
  ManageOrdersIcon,
  ManageTransactionsIcon,
} from "@lingdian/icons/miniapp";
import type { ManageEntry } from "@/types/member";

defineProps<{
  entries: ManageEntry[];
}>();

</script>

<style scoped>
.manage {
  margin: var(--ld-page-padding, 24rpx) var(--ld-page-padding, 24rpx) 0;
  padding: var(--ld-card-padding, 24rpx);
  border-radius: var(--ld-radius-16, 16px);
  background: #ffffff;
  box-shadow: var(--ld-mini-shadow-card);
}

.grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0;
}

.entry {
  position: relative;
  text-align: center;
}

.separator {
  position: absolute;
  right: 0;
  top: 6rpx;
  width: 1rpx;
  height: 72rpx;
  background: rgba(23, 23, 23, 0.08);
}

.icon-shell {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56rpx;
  height: 56rpx;
  margin: 0 auto 12rpx;
  border-radius: 999rpx;
  background: rgba(18, 163, 82, 0.1);
  color: var(--ld-mini-primary);
}

.icon {
  width: 32rpx;
  height: 32rpx;
}

.entry-label {
  color: var(--ld-mini-text);
  font-size: var(--ld-font-sm, 24rpx);
  font-weight: 700;
}
</style>
