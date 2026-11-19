<script setup lang="ts">
import type { PaginationNextProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import type { ButtonVariants } from '../button'
import { ChevronRight } from '@lingdian/icons/web'
import { reactiveOmit } from "@vueuse/core"
import { cn } from '../utils'
import { PaginationNext, useForwardProps } from "reka-ui"
import { buttonVariants } from '../button'

const props = withDefaults(defineProps<PaginationNextProps & {
  size?: ButtonVariants["size"]
  class?: HTMLAttributes["class"]
}>(), {
  size: "default",
})

const delegatedProps = reactiveOmit(props, "class", "size")
const forwarded = useForwardProps(delegatedProps)
</script>

<template>
  <PaginationNext
    data-slot="pagination-next"
    :class="cn(buttonVariants({ variant: 'ghost', size }), 'gap-1 px-2.5 sm:pr-2.5', props.class)"
    v-bind="forwarded"
  >
    <slot>
      <span class="hidden sm:block">Next</span>
      <ChevronRight />
    </slot>
  </PaginationNext>
</template>
