<script setup lang="ts">
import { computed } from 'vue'
import {
  DialogClose,
  DialogContent,
  DialogPortal,
  type DialogContentEmits,
  type DialogContentProps,
  useForwardPropsEmits,
} from 'reka-ui'
import { X } from '@lingdian/icons/web'
import { cn } from '../utils'
import { Button } from '../button'
import DialogOverlay from './DialogOverlay.vue'

defineOptions({ inheritAttrs: false })

const props = defineProps<DialogContentProps & {
  class?: string
  closeLabel?: string
  closeDisabled?: boolean
  side?: 'left' | 'right'
}>()
const emit = defineEmits<DialogContentEmits>()
const forwarded = useForwardPropsEmits(computed(() => {
  const { class: _class, closeLabel: _closeLabel, closeDisabled: _closeDisabled, side: _side, ...rest } = props
  return rest
}), emit)
</script>

<template>
  <DialogPortal>
    <DialogOverlay />
    <DialogContent
      :data-slot="props.side ? 'sheet-content' : 'dialog-content'"
      v-bind="{ ...$attrs, ...forwarded }"
      :class="
        cn(
          'fixed z-50 gap-4 bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out',
          props.side
            ? 'top-0 h-dvh w-[min(520px,100vw)] overflow-y-auto'
            : 'left-1/2 top-1/2 grid w-[min(96vw,820px)] max-w-4xl -translate-x-1/2 -translate-y-1/2 rounded-lg border data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          props.side === 'right' && 'right-0 border-l data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right',
          props.side === 'left' && 'left-0 border-r data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left',
          props.class,
        )
      "
    >
      <slot />

      <DialogClose as-child>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          :disabled="props.closeDisabled"
          class="absolute right-4 top-4 size-9 rounded-xs text-muted-foreground opacity-70 hover:opacity-100"
        >
          <X class="size-4" />
          <span class="sr-only">{{ props.closeLabel ?? '关闭' }}</span>
        </Button>
      </DialogClose>
    </DialogContent>
  </DialogPortal>
</template>
