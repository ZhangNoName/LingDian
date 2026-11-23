<template>
  <view class="thumbnail" :class="{ compact, hero, small }">
    <image v-if="src && !failed" class="image" :src="src" mode="aspectFit" :lazy-load="!hero" @error="failed = true" />
    <view v-else class="image-placeholder"><text>图片待更新</text></view>
  </view>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";

const props = defineProps<{ src: string; compact?: boolean; hero?: boolean; small?: boolean }>();
const failed = ref(false);
watch(() => props.src, () => { failed.value = false; });
</script>

<style scoped>
.thumbnail {
  width: 100%;
  height: 196rpx;
  overflow: hidden;
  border-radius: var(--ld-radius-8, 8px);
  background: #fff7ee;
}
.compact { width: 152rpx; height: 152rpx; }
.hero { height: 376rpx; border-radius: var(--ld-radius-16); }
.small { width: 104rpx; height: 82rpx; }
.image, .image-placeholder { display: block; width: 100%; height: 100%; }
.image-placeholder {
  display: grid;
  place-items: center;
  color: var(--ld-mini-text-muted);
  font-size: var(--ld-font-xs);
}
</style>
