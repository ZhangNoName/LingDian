<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '../utils'

const props = defineProps<{
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <div
    data-slot="card-footer"
    :class="cn('flex items-center px-6 [.border-t]:pt-6 group-data-[size=sm]/card:px-4', props.class)"
  >
    <slot />
  </div>
</template>
