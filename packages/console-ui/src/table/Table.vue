<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '../utils'

const props = defineProps<{
  class?: HTMLAttributes['class']
  tableStyle?: HTMLAttributes['style']
  containerClass?: HTMLAttributes['class']
  framed?: boolean
}>()
</script>

<template>
  <div
    data-slot="table-container"
    :class="cn('relative min-w-0 max-w-full overflow-auto', framed ? 'w-auto rounded-table border bg-card' : 'w-full', props.containerClass)"
  >
    <table data-slot="table" :style="tableStyle" :class="cn('w-full caption-bottom text-sm', props.class)">
      <slot />
    </table>
  </div>
</template>
