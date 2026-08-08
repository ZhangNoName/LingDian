<template>
  <view class="manage">
    <view class="grid">
      <view
        v-for="(entry, index) in entries"
        :key="entry.key"
        class="entry"
        :class="{ unavailable: !entry.available }"
        :role="entry.available ? 'button' : undefined"
        :tabindex="entry.available ? 0 : -1"
        :aria-disabled="!entry.available"
        @keydown.enter="selectEntry(entry)"
        @tap="selectEntry(entry)"
      >
        <view class="icon-shell">
          <ManageOrdersIcon v-if="entry.key === 'orders'" class="icon" aria-hidden="true" />
          <ManageAddressIcon v-else-if="entry.key === 'address'" class="icon" aria-hidden="true" />
          <ManageFavoritesIcon v-else-if="entry.key === 'favorites'" class="icon" aria-hidden="true" />
          <ManageTransactionsIcon v-else-if="entry.key === 'transactions'" class="icon" aria-hidden="true" />
          <ManageFallbackIcon v-else class="icon" aria-hidden="true" />
        </view>
        <text class="entry-label">{{ entry.label }}</text>
        <text v-if="!entry.available" class="entry-status">开发中</text>
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

const emit = defineEmits<{
  (event: "select", entry: ManageEntry): void;
}>();

function selectEntry(entry: ManageEntry) {
  if (entry.available) emit("select", entry);
}

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

.entry.unavailable {
  opacity: 0.55;
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
  display: block;
  width: 32rpx;
  height: 32rpx;
  font-size: 32rpx;
  line-height: 32rpx;
}

.entry-label {
  color: var(--ld-mini-text);
  font-size: var(--ld-font-sm, 24rpx);
  font-weight: 700;
}

.entry-status {
  display: block;
  margin-top: 4rpx;
  color: #666666;
  font-size: 20rpx;
}
</style>
