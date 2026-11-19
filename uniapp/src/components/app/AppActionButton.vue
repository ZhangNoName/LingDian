<template>
  <button
    class="action"
    :class="['action-' + variant, 'action-' + size]"
    :disabled="disabled || loading"
    :loading="loading"
    role="button"
    :aria-disabled="disabled || loading ? 'true' : 'false'"
    :tabindex="disabled || loading ? -1 : 0"
    @tap.stop="activate"
    @keydown="activateFromKeyboard"
  ><slot /></button>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  variant?: "primary" | "outline" | "danger";
  size?: "small" | "default" | "large";
  disabled?: boolean;
  loading?: boolean;
}>(), { variant: "primary", size: "default" });

const emit = defineEmits<{ (event: "activate"): void }>();
function activate() {
  if (!props.disabled && !props.loading) emit("activate");
}
function activateFromKeyboard(event: KeyboardEvent) {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  event.stopPropagation();
  if (!event.repeat) activate();
}
</script>

<style scoped>
.action {
  box-sizing: border-box;
  margin: 0;
  padding: 0 24rpx;
  border: 1rpx solid transparent;
  border-radius: var(--ld-radius-8, 8px);
  font-weight: 600;
  white-space: nowrap;
}
.action::after { border: 0; }
.action-small { padding: 0 16rpx; font-size: 24rpx; line-height: 54rpx; }
.action-default { font-size: 26rpx; line-height: 66rpx; }
.action-large { font-size: 30rpx; line-height: 78rpx; }
.action-primary { background: var(--ld-mini-primary); color: white; }
.action-outline, .action-danger { border-color: var(--ld-mini-border); background: var(--ld-mini-surface); color: var(--ld-mini-text); }
.action-danger { color: #b42318; }
.action[disabled] { opacity: .55; }
</style>
