<script setup lang="ts">
import { DialogDescription, type DialogDescriptionProps, useForwardProps } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = defineProps<DialogDescriptionProps & { class?: string }>()
const forwarded = useForwardProps(props)
</script>

<template>
  <DialogDescription v-bind="forwarded" :class="cn('text-sm leading-6 text-muted-foreground', props.class)">
    <slot />
  </DialogDescription>
</template>
