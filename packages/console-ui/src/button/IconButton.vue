<script setup lang="ts">
import type { Component } from 'vue'
import Button from './Button.vue'
import type { ButtonVariants } from './variants'

withDefaults(defineProps<{
  icon: Component
  label: string
  variant?: ButtonVariants['variant']
  size?: 'icon-xs' | 'icon-sm' | 'icon' | 'icon-lg'
  asChild?: boolean
}>(), { variant: 'ghost', size: 'icon-sm' })
</script>

<template>
  <Button
    :as-child="asChild"
    :type="asChild ? undefined : 'button'"
    :variant="variant"
    :size="size"
    :aria-label="label"
    :title="label"
  >
    <slot><component :is="icon" aria-hidden="true" /></slot>
  </Button>
</template>
