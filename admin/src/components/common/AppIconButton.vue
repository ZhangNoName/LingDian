<script setup lang="ts">
import { Button } from '@lingdian/console-ui/button'
import type { Component } from 'vue'

defineOptions({ inheritAttrs: false })
defineProps<{ icon: Component }>()
</script>

<template>
  <Button type="button" class="icon-button" v-bind="$attrs">
    <span class="icon-button__content">
      <span class="icon-button__icon" aria-hidden="true"><component :is="icon" /></span>
      <span class="icon-button__label"><slot /></span>
    </span>
  </Button>
</template>

<style scoped>
.icon-button__content { display: inline-flex; align-items: center; gap: 6px; }
</style>
