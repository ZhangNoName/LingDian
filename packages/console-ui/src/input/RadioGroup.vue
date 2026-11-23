<script setup lang="ts">
import type { RadioGroupRootEmits, RadioGroupRootProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import { RadioGroupRoot, useForwardPropsEmits } from 'reka-ui'
import { nextTick } from 'vue'
import { cn } from '../utils'

const props = defineProps<RadioGroupRootProps & { class?: HTMLAttributes['class'] }>()
const emit = defineEmits<RadioGroupRootEmits>()
const forwarded = useForwardPropsEmits(reactiveOmit(props, 'class'), emit)

const arrowKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']

async function checkFocusedRadio(event: KeyboardEvent) {
  if (!event.defaultPrevented || !arrowKeys.includes(event.key)) return
  const group = event.currentTarget
  const previous = event.target
  if (!(group instanceof HTMLElement) || !(previous instanceof HTMLElement)) return
  if (!previous.matches('[role="radio"]') || previous.closest('[role="radiogroup"]') !== group) return

  await nextTick()
  const focused = group.ownerDocument.activeElement
  // Reka checks the focused item on a timer and can miss a quick key release.
  setTimeout(() => {
    if (focused instanceof HTMLElement && focused !== previous
      && focused === group.ownerDocument.activeElement
      && focused.closest('[role="radiogroup"]') === group
      && focused.matches('[role="radio"][aria-checked="false"]')) {
      focused.click()
    }
  }, 0)
}
</script>

<template>
  <RadioGroupRoot data-slot="radio-group" v-bind="forwarded" :class="cn('grid gap-3', props.class)" @keydown="checkFocusedRadio">
    <slot />
  </RadioGroupRoot>
</template>
