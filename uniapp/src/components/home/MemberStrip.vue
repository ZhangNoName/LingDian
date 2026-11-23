<template>
  <view v-if="presentation.isSignedIn" class="member-strip">
    <AppIcon name="profile" tone="primary" />
    <text class="name">{{ presentation.displayName }}</text>
  </view>
  <button v-else class="member-strip login-action" @tap="$emit('login')" @keydown.enter="$emit('login')">
    <AppIcon name="profile" tone="primary" />
    <text class="name">{{ presentation.displayName }}</text>
    <AppIcon name="next" tone="muted" />
  </button>
</template>

<script setup lang="ts">
import AppIcon from "@/components/app/AppIcon.vue";
import type { CustomerPresentation } from "@/services/customer-presentation";

defineProps<{
  presentation: CustomerPresentation;
}>();

defineEmits<{
  (event: "login"): void;
}>();
</script>

<style scoped>
.member-strip {
  display: flex;
  box-sizing: border-box;
  align-items: center;
  gap: 14rpx;
  width: 100%;
  min-height: 88rpx;
  margin: 0;
  padding: 14rpx var(--ld-card-padding, 24rpx);
  border: 1rpx solid var(--ld-mini-border);
  border-radius: var(--ld-radius-8);
  background: var(--ld-mini-surface);
  color: var(--ld-mini-text);
  text-align: left;
}

.login-action::after { border: 0; }

.name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  font-size: var(--ld-font-base);
  font-weight: 750;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
