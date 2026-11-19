<template>
  <view class="thumbnail" :class="{ compact }">
    <image v-if="src && !failed" class="image" :src="src" mode="aspectFill" lazy-load @error="failed = true" />
    <view v-else class="image-placeholder"><text>图片待更新</text></view>
  </view>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";

const props = defineProps<{ src: string; compact?: boolean }>();
const failed = ref(false);
watch(() => props.src, () => { failed.value = false; });
</script>

<style scoped>
.thumbnail {
  width: 100%;
  height: 148rpx;
  overflow: hidden;
  border-radius: var(--ld-radius-8, 8px);
  background: var(--ld-mini-bg);
}
.compact { width: 176rpx; height: 132rpx; }
.image, .image-placeholder { display: block; width: 100%; height: 100%; }
.image-placeholder {
  display: grid;
  place-items: center;
  color: var(--ld-mini-text-muted);
  font-size: var(--ld-font-xs);
}
</style>
