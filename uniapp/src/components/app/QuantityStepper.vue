<template>
  <view class="stepper" :class="{ compact }">
    <template v-if="!collapseAtZero || modelValue > 0">
      <button class="round" :disabled="disabled || modelValue <= min" :aria-label="itemName ? `减少${itemName}数量` : '减少数量'" @tap="emitValue(modelValue - 1)">
        <AppIcon name="minus" :size="28" tone="muted" />
      </button>
      <text class="count">{{ modelValue }}</text>
    </template>
    <button class="round plus" :disabled="disabled || modelValue >= max" :aria-label="itemName ? `增加${itemName}数量` : '增加数量'" @tap="emitValue(modelValue + 1)">
      <AppIcon name="plus" :size="28" tone="white" />
    </button>
  </view>
</template>

<script setup lang="ts">
import AppIcon from "@/components/app/AppIcon.vue";
import { MAX_LINE_QUANTITY } from "@/services/cart";
const props = withDefaults(
  defineProps<{
    modelValue: number;
    min?: number;
    max?: number;
    disabled?: boolean;
    collapseAtZero?: boolean;
    itemName?: string;
    compact?: boolean;
  }>(),
  {
    min: 1,
    max: MAX_LINE_QUANTITY,
  },
);

const emit = defineEmits<{
  (event: "update:modelValue", value: number): void;
}>();

function emitValue(value: number) {
  const nextValue = Math.min(props.max, Math.max(props.min, value));
  emit("update:modelValue", nextValue);
}
</script>

<style scoped>
.stepper {
  display: flex;
  align-items: center;
  gap: 20rpx;
}

.round {
  display: grid;
  place-items: center;
  width: 54rpx;
  height: 54rpx;
  margin: 0;
  padding: 0;
  border: 1rpx solid #dddddd;
  border-radius: 50%;
  background: #ffffff;
  color: #999999;
}


.round::after {
  border: 0;
}

.plus {
  border: 0;
  background: var(--ld-mini-primary);
  color: #ffffff;
}

.count {
  color: var(--ld-mini-text);
  font-size: 32rpx;
  font-weight: 700;
}

.compact {
  gap: 8rpx;
}

.compact .round {
  width: 56rpx;
  height: 56rpx;
  border-radius: var(--ld-radius-8, 8px);
}

.compact .count {
  min-width: 36rpx;
  font-size: var(--ld-font-sm, 24rpx);
  font-variant-numeric: tabular-nums;
  text-align: center;
}
</style>
