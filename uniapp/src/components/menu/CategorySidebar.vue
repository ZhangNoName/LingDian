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
  display: block;
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
  min-height: var(--ld-sidebar-row-height, 116rpx);
  padding: 0 20rpx;
  color: #747474;
  text-align: center;
  font-size: var(--ld-font-sm, 24rpx);
  line-height: 1.25;
}

.category.active {
  background: #ffffff;
  color: var(--ld-mini-text);
  font-weight: 900;
}

.category.active::before {
  position: absolute;
  left: 12rpx;
  top: 50%;
  width: 6rpx;
  height: 40rpx;
  border-radius: 999rpx;
  background: var(--ld-mini-primary);
  content: "";
  transform: translateY(-50%);
}
</style>
