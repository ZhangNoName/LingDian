<script setup lang="ts">
import {
  DialogClose,
  DialogContent,
  DialogOverlay,
  DialogPortal,
  type DialogContentProps,
  useForwardProps,
} from 'reka-ui'
import { X } from 'lucide-vue-next'
import { cn } from '@/lib/utils'
import { Button } from '@/baseComponents/button'

const props = defineProps<DialogContentProps & { class?: string }>()
const forwarded = useForwardProps(props)
</script>

<template>
  <DialogPortal>
    <DialogOverlay
      class="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
    />
    <DialogContent
      v-bind="forwarded"
      :class="
        cn(
          'fixed left-1/2 top-1/2 z-50 grid w-[min(96vw,820px)] max-w-4xl -translate-x-1/2 -translate-y-1/2 gap-4 rounded-lg border border-border/80 bg-background p-6 duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          props.class,
        )
      "
    >
      <slot />

      <DialogClose as-child>
        <Button
          variant="ghost"
          size="icon"
          class="absolute right-4 top-4 size-9 rounded-md text-muted-foreground hover:bg-muted"
        >
          <X class="size-4" />
          <span class="sr-only">关闭</span>
        </Button>
      </DialogClose>
    </DialogContent>
  </DialogPortal>
</template>
