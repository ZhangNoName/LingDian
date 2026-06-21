<template>
  <scroll-view class="sidebar" scroll-y scroll-with-animation :scroll-into-view="activeDomId">
    <view
      v-for="category in categories"
      :key="category.id"
      :id="getNavDomId(category.id)"
      class="category"
      :class="{ active: category.id === activeId }"
      @tap="$emit('select', category.id)"
    >
      <text>{{ category.name }}</text>
    </view>
  </scroll-view>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { MenuCategory } from "@/types/menu";

const props = defineProps<{
  categories: MenuCategory[];
  activeId: string;
}>();

defineEmits<{
  (event: "select", categoryId: string): void;
}>();

const activeDomId = computed(() => getNavDomId(props.activeId));

function getNavDomId(categoryId: string) {
  return `nav-${categoryId}`;
}
</script>

<style scoped>
.sidebar {
  width: 156rpx;
  height: 100%;
  min-height: 0;
  background: #f5f5f5;
}

.category {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 132rpx;
  padding: 0 20rpx;
  color: #747474;
  text-align: center;
  font-size: 24rpx;
  line-height: 1.25;
}

.category.active {
  background: #ffffff;
  color: #111111;
  font-weight: 900;
}

.category.active::before {
  position: absolute;
  left: 0;
  top: 42rpx;
  width: 8rpx;
  height: 48rpx;
  border-radius: 0 8rpx 8rpx 0;
  background: var(--ld-mini-primary);
  content: "";
}
</style>
