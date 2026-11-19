<template>
  <image
    class="glyph"
    :src="images[name][tone]"
    :style="{ width: size + 'rpx', height: size + 'rpx' }"
    mode="aspectFit"
    aria-hidden="true"
  />
</template>

<script setup lang="ts">
import type { MiniappGlyphName } from "@lingdian/icons/miniapp";
import images from "virtual:lingdian-miniapp-icons";

withDefaults(defineProps<{
  name: MiniappGlyphName;
  size?: number;
  tone?: "text" | "muted" | "primary" | "white";
}>(), { size: 32, tone: "text" });
</script>

<style scoped>
.glyph { display: block; flex: none; }
</style>
