<script setup lang="ts">
import { DialogTitle, type DialogTitleProps, useForwardProps } from 'reka-ui'
import { cn } from '../utils'

const props = defineProps<DialogTitleProps & { class?: string }>()
const forwarded = useForwardProps(props)
</script>

<template>
  <DialogTitle data-slot="dialog-title" v-bind="forwarded" :class="cn('text-lg leading-none font-semibold', props.class)">
    <slot />
  </DialogTitle>
</template>
