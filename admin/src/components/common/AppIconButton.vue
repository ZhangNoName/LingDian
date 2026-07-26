<script setup lang="ts">
import type { Component } from 'vue'

defineOptions({ inheritAttrs: false })
defineProps<{ icon: Component }>()
</script>

<template>
  <el-button class="icon-button" v-bind="$attrs">
    <span class="icon-button__content">
      <el-icon class="icon-button__icon"><component :is="icon" /></el-icon>
      <span class="icon-button__label"><slot /></span>
    </span>
  </el-button>
</template>

<style scoped>
.icon-button__content { display: inline-flex; align-items: center; gap: 6px; }
</style>
