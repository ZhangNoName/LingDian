<script setup lang="ts">
import { DialogOverlay, type DialogOverlayProps, useForwardProps } from 'reka-ui'
import { cn } from '../utils'

const props = defineProps<DialogOverlayProps & { class?: string }>()
const forwarded = useForwardProps(props)
</script>

<template>
  <DialogOverlay
    data-slot="dialog-overlay"
    v-bind="forwarded"
    :class="
      cn(
        'fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        props.class,
      )
    "
  />
</template>
