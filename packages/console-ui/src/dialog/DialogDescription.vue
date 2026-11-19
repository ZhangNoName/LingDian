<script setup lang="ts">
import { DialogDescription, type DialogDescriptionProps, useForwardProps } from 'reka-ui'
import { cn } from '../utils'

const props = defineProps<DialogDescriptionProps & { class?: string }>()
const forwarded = useForwardProps(props)
</script>

<template>
  <DialogDescription data-slot="dialog-description" v-bind="forwarded" :class="cn('text-sm text-muted-foreground', props.class)">
    <slot />
  </DialogDescription>
</template>
