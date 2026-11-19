<script setup lang="ts">
import type { RadioGroupItemProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import { RadioGroupIndicator, RadioGroupItem, useForwardProps } from 'reka-ui'
import { cn } from '../utils'

const props = defineProps<RadioGroupItemProps & { class?: HTMLAttributes['class'] }>()
const forwarded = useForwardProps(reactiveOmit(props, 'class'))
</script>

<template>
  <RadioGroupItem
    data-slot="radio-group-item"
    v-bind="forwarded"
    :class="cn(
      'aspect-square size-4 shrink-0 rounded-full border border-input text-primary shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 dark:bg-input/30 disabled:cursor-not-allowed disabled:opacity-50',
      props.class,
    )"
  >
    <RadioGroupIndicator data-slot="radio-group-indicator" class="flex size-full items-center justify-center">
      <span aria-hidden="true" class="size-2 rounded-full bg-primary" />
    </RadioGroupIndicator>
  </RadioGroupItem>
</template>
