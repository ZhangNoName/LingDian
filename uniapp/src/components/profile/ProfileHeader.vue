<template>
  <view class="header">
    <image v-if="avatarUrl" class="avatar-image" :src="avatarUrl" mode="aspectFill" aria-label="头像" />
    <view v-else class="avatar"><AppIcon name="profile" :size="48" tone="muted" /></view>
    <view class="identity">
      <text class="level">{{ presentation.displayName }}</text>
    </view>
    <AppActionButton v-if="editable" size="small" variant="outline" @activate="$emit('edit')">编辑个人信息</AppActionButton>
  </view>
</template>

<script setup lang="ts">
import AppIcon from "@/components/app/AppIcon.vue";
import AppActionButton from "@/components/app/AppActionButton.vue";
import type { CustomerPresentation } from "@/services/customer-presentation";

defineProps<{
  presentation: CustomerPresentation;
  avatarUrl?: string | null;
  editable: boolean;
}>();

defineEmits<{
  edit: [];
}>();
</script>

<style scoped>
.header {
  display: flex;
  align-items: center;
  gap: var(--ld-card-gap, 20rpx);
  margin: 0 var(--ld-page-padding) var(--ld-card-gap);
  padding: 24rpx;
  border-radius: var(--ld-radius-16);
  background: linear-gradient(120deg, var(--ld-mini-primary-soft), var(--ld-mini-warning-bg));
}

.identity { flex: 1; min-width: 0; }
.avatar {
  display: grid;
  place-items: center;
  flex: none;
  width: 96rpx;
  height: 96rpx;
  border-radius: 50%;
  background: var(--ld-mini-primary-soft);
}

.avatar-image {
  display: block;
  flex: none;
  width: 96rpx;
  height: 96rpx;
  border-radius: 50%;
}

.level {
  display: block;
  color: var(--ld-mini-primary-pressed);
  font-size: var(--ld-font-display);
  font-weight: 900;
  overflow-wrap: anywhere;
}
</style>
