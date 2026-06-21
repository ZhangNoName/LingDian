<template>
  <view class="skeleton" :class="[`skeleton--${radius}`, { shimmer }]">
    <slot />
  </view>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    radius?: "sm" | "md" | "lg" | "round";
    shimmer?: boolean;
  }>(),
  {
    radius: "md",
    shimmer: true,
  },
);
</script>

<style scoped>
.skeleton {
  overflow: hidden;
  background: linear-gradient(90deg, #f0f0f0 0%, #fafafa 45%, #eeeeee 100%);
}

.skeleton--sm {
  border-radius: 8rpx;
}

.skeleton--md {
  border-radius: 16rpx;
}

.skeleton--lg {
  border-radius: 28rpx;
}

.skeleton--round {
  border-radius: 999rpx;
}

.shimmer {
  background-size: 220% 100%;
  animation: shimmer 1.6s ease-in-out infinite;
}

@keyframes shimmer {
  0% {
    background-position: 120% 0;
  }

  100% {
    background-position: -120% 0;
  }
}
</style>
