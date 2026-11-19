<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '../utils'

const props = withDefaults(defineProps<{
  class?: HTMLAttributes['class']
  size?: 'default' | 'sm'
}>(), {
  size: 'default',
})
</script>

<template>
  <div
    data-slot="card"
    :data-size="size"
    :class="cn('bg-card text-card-foreground group/card flex flex-col gap-6 overflow-hidden rounded-xl border py-6 shadow-sm data-[size=sm]:gap-4 data-[size=sm]:py-4', props.class)"
  >
    <slot />
  </div>
</template>
