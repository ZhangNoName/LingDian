<template>
  <view class="stepper">
    <button class="round" :disabled="modelValue <= min" @tap="emitValue(modelValue - 1)">−</button>
    <text class="count">{{ modelValue }}</text>
    <button class="round plus" :disabled="modelValue >= max" @tap="emitValue(modelValue + 1)">+</button>
  </view>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    modelValue: number;
    min?: number;
    max?: number;
  }>(),
  {
    min: 1,
    max: 99,
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
  font-size: 38rpx;
  line-height: 50rpx;
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
</style>
